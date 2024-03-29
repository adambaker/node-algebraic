#!/usr/bin/env node

var m     = require('./monoid');
var agg_p = require('./monoid/parallel').aggregate_p;
var test  = require('./monoid/test');
var qc    = require('quickcheck');

var Sum   = m.Sum;

test.test_all_monoids();

function create_sum(length)
{
  arr = Array(length);
  for(var i=0; i<length; i++) {
    arr[i] = i+1;
  }
  return arr;
}
function agg_sum(length) {
  var arry = create_sum(length).map(function(i){return new Sum(i)});
  return m.aggregate(arry, Sum).val == length*(length+1)/2;
}

function agg_sum_primitive(length) {
  return m.aggregatePrimitive(create_sum(length), Sum) == length*(length+1)/2;
}

console.log('Testing aggregate on Sum');
qc.forAll(agg_sum, qc.arbByte);
console.log('Testing aggregatePrimitive on Sum');
qc.forAll(agg_sum_primitive, qc.arbByte);

var len = 20000000;
var arrPrim = create_sum(len);
/*var arr = arrPrim.map(function(i){return new Sum(i)});
var time = process.hrtime();
m.aggregate(arr);
var diff = process.hrtime(time);
console.log('aggregate took %d seconds and %d nanoseconds', diff[0], diff[1]);
*/
var time = process.hrtime();
var answer = m.aggregatePrimitive(arrPrim, Sum);
var diff = process.hrtime(time);
console.log('aggregate took %d seconds and %d nanoseconds', diff[0], diff[1]);

time = process.hrtime();
agg_p(arrPrim, Sum, 6, function(result) {
  var diff = process.hrtime(time);
  console.log('aggregate_p took %d seconds and %d nanoseconds', diff[0], diff[1]);
  console.log('answer: ' + answer);
  console.log('got:    ' + result);
  process.exit(0);
});
