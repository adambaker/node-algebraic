#!/usr/bin/env node
var qc = require("quickcheck");

function id(a) { return a; }
Function.prototype.o = function(f) {
  return function(x) { return this(f(x)); }
}; //function composition, like an opertor.

function Monoid(type, props)
{
  var proto = type.prototype;
  if( (proto.id == null && props.id == null) ) throw('Monoid identity not defined for ' + type);
  if( !(proto.dot || props.dot) ) throw('Monoid operator not defined for ' + type);

  proto.id  = proto.id  || props.id;
  proto.dot = proto.dot || props.dot;
  proto._   = proto._   || proto.dot; //_ alias because js doesn't allow user defined operators

  type.dot = function(a, b) {
    if( !( a instanceof type && b instanceof type ) )
      throw(type + "'s dot called with non-" + type + " argument.");

    return a._(b);
  }
  type.id = proto.id;

  //optional properties. Used for quick checking laws
  proto.eq  = proto.eq  || props.eq;
  proto.arb = proto.arb || props.arb;

  type.eq  = type.eq  ||function(a, b) { return a.eq(b) };
  type.arb = type.arb ||props.arb;

  type.laws = {
    left_identity:  function(a){ return type.id._(a).eq(a); },
    right_identity: function(a){ return a._(type.id).eq(a); },
    associativity:  function(a, b, c){ return a._(b._(c)).eq( (a._(b))._(c) ); }
  };

  proto.monoid = type; //instances of subtypes know the type that makes them a monoid
  Monoid.known.push(type);
}

Monoid.known = []; //known monoid types.

Monoid.dot   = function(a, b) {return a.monoid.dot(a,b);} //minimal type checking

exports.Monoid = Monoid;

function aggregate(monoid, arry) {
  return arry.reduce(monoid.dot, monoid.id);
}
exports.aggregate = aggregate;

function check_laws(m)
{
  var num_errors = 0;
  console.log("Testing " + m.name + "'s monoid laws:");
  console.log("left identity:");
  num_errors += qc.forAll(m.laws.left_identity,  m.arb) ? 0 : 1;
  console.log("right identity:");
  num_errors += qc.forAll(m.laws.right_identity, m.arb) ? 0 : 1;
  console.log("associativity:");
  num_errors += qc.forAll(m.laws.associativity,  m.arb, m.arb, m.arb) ? 0 : 1;
  console.log();
  return num_errors;
}
exports.check_laws = check_laws;

function test_all_monoids()
{
  var results = Monoid.known
    .filter(function(m) {return m.eq && m.arb;})
    .map(check_laws)
    .reduce(function(a,b){return a+b;}, 0)
  ;
  console.log(results + ' test(s) failed.');
}
exports.test_all_monoids = test_all_monoids;
