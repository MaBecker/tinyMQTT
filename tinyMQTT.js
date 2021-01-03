// ==ClosureCompiler==
// @output_file_name default.js
// @compilation_level SIMPLE_OPTIMIZATIONS
// @language_out ECMASCRIPT_2015
// ==/ClosureCompiler==

/*
 * tinyMQTT.js
 * Stripped out MQTT module that does basic PUBSUB
 * Ollie Phillips 2015
 * MIT License
 */

(function() {
    var _q,
        TMQ = function(server, optns) {
            var opts = optns || {};
            _q = this;
            _q.svr = server;
            _q.prt = opts.port || 1883;
            _q.ka = opts.keep_alive || 60;
            _q.usr = opts.username;
            _q.pwd = opts.password;
            _q.cn = 0;
            _q.ri = opts.reconnect_interval || 2000;
            _q.wt = opts.will_topic;
            _q.wp = opts.will_payload || "";
        },
        p = TMQ.prototype,

        sFCC = String.fromCharCode,

        cCa = (str, idx) => str.charCodeAt(idx),
        cI = (iID) => iID && clearInterval(iID),
        sS = (d, o, l) => d.substr(o, l),

        onDat = (data) => {
            if (cCa(data, 0) >> 4 === 3) {
                var data_len = data.length,
                    packet_len = cCa(data, 1),
                    var_len = (cCa(data, 2) << 8) | cCa(data, 3);
                _q.emit("message", {
                    topic: sS(data, 4, var_len),
                    message: sS(data, 4 + var_len, packet_len - var_len - 2)
                });
                if (data_len > packet_len + 2)
                    onDat(sS(data, packet_len + 2, data_len - packet_len));
            }
        },

        mqStr = (str) => sFCC(str.length >> 8, str.length & 255) + str,

        mqPkt = (cmd, variable, payload) => sFCC(cmd, variable.length + payload.length) + variable + payload,

        mqCon = (id) => {
            // Authentication?
            var flags = 0,
                payload = mqStr(id);
            if (_q.wt) {
                flags |= 0x24; /*will retain + will flag*/
                payload += mqStr(_q.wt) + mqStr(_q.wp);
            }
            if (_q.usr && _q.pwd) {
                flags |= 0xC0;
                payload += mqStr(_q.usr) + mqStr(_q.pwd);
            }
            return mqPkt(
                0x10 /*0b00010000*/ ,
                mqStr("MQTT") /*protocol name*/ +
                sFCC(
                    4 /*protocol level*/ ,
                    flags,
                    _q.ka >> 8,
                    _q.ka & 255 /*keepalive*/
                ),
                payload
            );
        };

    p._sCd = () => {
        _q.con = cI(_q.con);
        _q.x1 = cI(_q.x1);
        _q.cn = 0;
        delete _q.cl;
        _q.emit("disconnected");
    };

    p.connect = () => {
        // Only try to connect, if there is no connection, or no pending connection
        if (!_q.cn || !_q.con) {
            _q.con = setInterval(() => {
                if (_q.cl) {
                    _q.cl.end();
                    delete _q.cl;
                }
                try {
                    _q.cl = require("net").connect({ host: _q.svr, port: _q.prt },
                        () => {
                            _q.con = cI(_q.con);
                            try {
                                _q.cl.write(mqCon(getSerial()));
                                _q.emit("connected");
                                _q.cn = 1;
                                _q.x1 = setInterval(() =>
                                    _q.cn && _q.cl.write(sFCC(12 << 4, 0)), _q.ka << 10);
                                _q.cl.on("data", onDat);
                                _q.cl.on("end", _q._sCd);
                            } catch (e) {
                                _q._sCd();
                            }
                        }
                    );
                } catch (e) {
                    _q._sCd();
                }
            }, _q.ri);
        }
    };

    p.subscribe = (topic) => {
        _q.cl.write(mqPkt((8 << 4 | 2), sFCC(1 << 8, 1 & 255), mqStr(topic) + sFCC(0)));
    };

    p.publish = (topic, data) => {
        if (topic.length + data.length > 127) throw "tMQTT-TL";
        if (_q.cn) {
            _q.cl.write(mqPkt(0x31 /*0b00110001*/ , mqStr(topic), data));
            _q.emit("published");
        }
    };

    p.disconnect = () => {
        if (_q.cn) {
            try {
                _q.cl.write(sFCC(14 << 4, 0));
            } catch (e) {
                _q._sCd();
            }
        }
    };

    // Exports
    exports.create = (svr, opts) => new TMQ(svr, opts);
})();