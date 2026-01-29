import { Readable } from "node:stream";

export const createLdapSyncEventChannel = () => {
  const streams = new Set();

  const subscribe = () => {
    const stream = new Readable({
      objectMode: true,
      read() {}
    });

    streams.add(stream);

    const cleanup = () => {
      streams.delete(stream);
    };

    stream.on("close", cleanup);
    stream.on("error", cleanup);
    stream.on("end", cleanup);

    return stream;
  };

  const publish = (event) => {
    for (const stream of streams) {
      stream.push(event);
    }
  };

  return {
    subscribe,
    publish
  };
};

export const buildLdapSyncEvent = ({ type, run, timestamp = new Date() }) => ({
  id: run?.id,
  event: "ldap.sync",
  data: JSON.stringify({
    id: run?.id,
    type,
    timestamp: timestamp.toISOString(),
    data: {
      run
    }
  })
});
