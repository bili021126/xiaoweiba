module.exports = {
  pipeline: jest.fn().mockResolvedValue({
    data: new Float32Array(384).fill(0.1)
  }),
  env: {
    allowLocalModels: false,
    useBrowserCache: false
  }
};
