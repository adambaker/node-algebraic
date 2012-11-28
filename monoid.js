#!/usr/bin/env node
var qc = require("quickcheck");

function id(a) { return a; }

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

function test_all_monoids()
{
  Monoid.known
    .filter(function(m) {return m.eq && m.arb;})
    .forEach(function(m){
      qc.forAll(m.laws.left_identity,  m.arb);
      qc.forAll(m.laws.right_identity, m.arb);
      qc.forAll(m.laws.associativity,  m.arb, m.arb, m.arb);
    })
  ;
}
exports.test_all_monoids = test_all_monoids;
