module.exports = {
  forbidden: [
    {
      name: 'no-app-to-infra',
      severity: 'error',
      from: { path: '^src/core/application' },
      to: { path: '^src/infrastructure' }
    }
  ]
};
