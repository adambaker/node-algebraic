var qc = require("quickcheck");
var m  = require('./monoid/core');
var i  = require('./monoid/instances');

var keys = Object.keys;

[m, i].forEach(function(module){
  keys(module).forEach(function(item) {
    exports[item] = module[item];
  })
});
