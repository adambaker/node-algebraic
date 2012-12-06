var qc = require('../quickcheck');
var m  = require('../monoid');
var zipWith = require('../functional').zipWith;

var Log = m.Log, Sum = m.Sum, Any = m.Any;

function check_laws(m)
{
  var log;
  console.log("Testing " + m.name + "'s monoid laws:");
  log = qc.forAll(m.laws.left_identity,  m.arb);
  log = log._( qc.forAll(m.laws.right_identity, m.arb) );
  log = log._( qc.forAll(m.laws.associativity,  m.arb, m.arb, m.arb) );
  if(log.failed.val){
    log.addLog('groups', [{name: m.name, info: log.info}]);
  };
  console.log()
  return log;
}
exports.check_laws = check_laws;

function test_all_monoids()
{
  var results = m.aggregate(
    m.Monoid.known
      .filter(function(m) {return m.eq && m.arb;})
      .map(check_laws)
  );

  if(results.failed.val)
  {
    console.log( results);
    console.log( results.total_failed.val + ' test(s) failed:');
    results['groups'].forEach(function(group){
      console.log('  '+group.name+' failed:');
      zipWith(
        function(prop, args){ return '    ' +prop + ': ' + args.join(','); },
        group.info.property, group.info.args
      ).forEach(function(msg) { console.log(msg)});
      //.forEach(console.log) != .forEach(function(msg){console.log(msg)})? wtf?
      console.log();
    })
  }
  else
  {
    console.log('All tests passed.');
  }
  return results;
}
exports.test_all_monoids = test_all_monoids;
