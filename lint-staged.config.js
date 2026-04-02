export default {
  'server/**/*.{ts,js}': ['eslint --fix', 'prettier --write'],
  'scripts/**/*.{ts,js}': ['eslint --fix', 'prettier --write'],
  '*.{ts,js,json,md}': ['prettier --write'],
};
