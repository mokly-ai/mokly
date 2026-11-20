# Sidecar Return Warm-Up

This page expands the
[background return](./mokly-sidecar-root-scheduling.md#background-return). A
head process that a return pass starts holds no generation. The warm-up
prepares the newest head generation on that process and replays recent renders
of that generation. So the first edit after Serve starts finds warm processes.

## Recorded Renders

The pool records each successful render request of the newest head generation
on a head process. It keeps the last 30 such requests, in the order in which
they finished. A successful head `bundle` of another generation clears the
record. A replayed render is not recorded.

## Warm-Up Steps

Each head process that a return pass starts gets one warm-up. The warm-up
sends the `restoreGeneration`, `cssModules`, `describe`, and `bindings` calls
of the newest head generation that the process lacks, in that order. Then it
replays the recorded render requests, oldest first. The pool discards each
result. It stores, publishes, and caches nothing from a warm-up, and a warm-up
changes no published output. A replayed render does not change the warm head
process. It counts toward the
[500-render rule](./mokly-sidecar-memory.md#sampling-and-recycling).

Each warm-up call is a quiet call: its request has `quiet: true`, and every
other request omits the field. From the start of a quiet call until its reply,
the sidecar drops each console, standard output, and standard error write of
the code that the call runs. Timing records of the call still appear. Two kinds
of output stay visible: the report that Node writes when a warm-up call crashes
its process, and output from code that runs after the call returns, such as a
timer.

Decision: a warm-up call is quiet. Rejected: warm-up output on the terminal,
because each returned process would repeat the console output of module
evaluation and of up to 30 views while Serve is idle. Rejected: a filter of the
forwarded lines in the pool, because the line reader runs on its own thread, so
a warm-up line could pass or the first line of the next request could drop. The
field is a design call and not a user decision, because the sidecar request
protocol is internal: the core and the sidecar ship together, and nothing
outside Mokly reads it.

Only Serve runs a warm-up, on the background worker of the return pass. A
return step comes first, so a warm-up starts only when no return step can
start. The warm-up sends one call at a time, and it warms one process at a
time. It starts no process, and it holds no process except the one that it
warms.

The warm-up sends its next call only while no request waits in the pool queue
and Serve has no admitted sidecar call. A request that waits takes the process
after the call in flight. The warm-up of that process continues when the pool
is idle again. A request that finds no idle process makes the same choice as
when the process runs a request.

Decision: a replay does not move the warm head process. Rejected: a move at
each replay, because background timing would then decide which process stays
protected from base requests, and each warmed process holds the same
generation, so the move gains nothing.

Decision: the warm-up runs only while the pool is idle. Rejected: a warm-up
beside requests, because CPU work beside a bundle competes with the core and
can cancel the gain. Rejected: a stop only when a request waits, because a call
that Serve admitted could then run on another process beside the warm-up.

Decision: an interrupted warm-up continues later. Rejected: an end at the first
request, because one request after the publication could then leave the
process cold.

## End

The warm-up of a process ends when it has replayed every recorded request, when
a call fails, when the process ends or leaves the head root, and when the
process holds another head generation. Every warm-up ends when a newer head
generation is bundled, when the newest head generation is released, when the
pool stops, and when a failed reap ends background return. A process that a
return pass starts later gets a warm-up of the newest head generation at that
time.

A warm-up never sends a replay that would bring the render count of its process
to 500. It ends instead. So only a render request, not a replay, brings a
process to 500 renders. The pool recycles the process after that request, under
the [500-render rule](./mokly-sidecar-memory.md#sampling-and-recycling). A
warm-up never recycles a process.

Decision: a warm-up ends before a replay that would bring its process to 500
renders. Rejected: a recycle by the warm-up when a replay reaches the limit,
because background work would then need a recycle path of its own.

A warm-up never sends a call of an older head generation. It never evaluates a
generation on a process that holds another head generation.

After a failed call, the pool keeps or replaces the process as after a failed
request. The pool reports no diagnostic for the failure, so only a crash report
of the process can reach the terminal. A later request that needs the same
input reports its own failure.

Decision: a newer head generation ends every warm-up. Rejected: a warm-up of
the newer generation, because the renders of the edit load it, and the warm-up
would compete with them. Rejected: a warm-up on a process that holds another
head generation, because an attempt that held two evaluated head generations on
one process raised the peak memory demand by 8%.

Decision: a failed warm-up call stays silent. Rejected: a diagnostic, because
the failure changes no result, and the request that needs the input reports a
real failure.
