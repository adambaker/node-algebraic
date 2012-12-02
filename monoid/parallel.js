var m = require('../monoid');
var cp = require('child_process');

var workers = Array(6);
var tasks = {};
var task = 0;

function worker_onmessage(message)
{
  var task = tasks[message['task']];
  task.parts[message['part']] = message['result'];
  task.completed++;

  if(task.completed == task.num_parts)
  {
    task.callback(m.aggregatePrimitive(task.parts, task.monoid));
    delete tasks[message['task']];
  }
}

for(i=0; i < 6; i++)
{
  workers[i] = cp.fork('monoid/worker.js');
  workers[i].on('message', worker_onmessage);
}

function aggregate_p(array, monoid, num_workers, callback)
{
  var arr;
  var w;
  var per_worker = Math.ceil(array.length / num_workers);

  tasks[task] = {
    monoid: monoid,
    num_parts: num_workers,
    completed: 0,
    callback: callback,
    parts: Array(num_workers)
  };

  for(var i = 0; i<num_workers; i++)
  {
    if(i+1 == num_workers) { arr = array.slice(i*per_worker); }
    else { arr = array.slice(i*per_worker, (i+1)*per_worker); }
    w = workers[i];
    w.send({
      'array': arr,
      'task': task,
      'part': i,
      'monoid': monoid.name
    });
  }
  task++;
}
exports.aggregate_p = aggregate_p;

