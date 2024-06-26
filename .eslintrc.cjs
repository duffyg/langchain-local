module.exports = {
    env: {
        browser: true,
        es2021: true
    },
    extends: 'standard',
    parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module'
    },
    rules: {
        indent: ['error', 4, { SwitchCase: 1 }],
        'brace-style': ['error', 'stroustrup', { allowSingleLine: true }]
    }
}
