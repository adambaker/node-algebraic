#!/usr/bin/env node

var Sum = require('./monoid/instances').Sum;
var m   = require('./monoid');
var qc  = require('quickcheck');
m.test_all_monoids();

function create_sum(length)
{
  arr = new Array(length);
  for(var i=0; i<length; i++) {
    arr[i] = new Sum(i+1);
  }
  return arr;
}
function agg_sum(length)
{
  return m.aggregate(Sum, create_sum(length));
}

console.log('Testing aggregate on Sum');
qc.forAll(agg_sum, qc.arbByte);

var len = 35000000;
var arr = create_sum(len);
var time = process.hrtime();
m.aggregate(Sum, arr);
var diff = process.hrtime(time);
console.log('aggregate took %d seconds and %d nanoseconds', diff[0], diff[1]);
