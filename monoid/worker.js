m = require('../monoid');
require('./instances');

process.on('message', function(message) {
  monoid = m.Monoid.byName[message['monoid']];
  message['result'] = m.aggregatePrimitive(message['array'], monoid);
  delete message['array'];
  process.send(message);
});

