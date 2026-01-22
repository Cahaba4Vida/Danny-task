const { getStore } = require("@netlify/blobs");

const store = getStore("fit-hub");

const readJson = async (key) => {
  const data = await store.get(key, { type: "json" });
  return data || null;
};

const writeJson = async (key, value) => {
  await store.set(key, JSON.stringify(value), {
    metadata: {
      contentType: "application/json",
    },
  });
  return value;
};

module.exports = {
  readJson,
  writeJson,
};
