const Transport = require('winston-transport');

class WsBroadcaster extends Transport {
  constructor(opts) {
    super(opts);
    this.clients = new Set();
  }

  setWsClients(clients) {
    this.clients = clients;
  }

  log(info, callback) {
    setImmediate(() => {
      this.emit('logged', info);
    });

    if (this.clients && this.clients.size > 0) {
      const message = JSON.stringify({
        type: 'log_message',
        level: info.level,
        message: info.message,
        timestamp: new Date().toISOString()
      });

      this.clients.forEach(client => {
        if (client.readyState === 1) { // WebSocket.OPEN
          client.send(message);
        }
      });
    }

    if (callback) {
      callback();
    }
  }
}

module.exports = WsBroadcaster;
