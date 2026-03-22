const fs = require('fs');

// 1. Bypass in Route API
let authApi = fs.readFileSync('app/api/auth/route.ts', 'utf8');
if (!authApi.includes("if (process.env.NODE_ENV === 'development') return true;")) {
    authApi = authApi.replace(/async function verifyCaptcha\(token: string\): Promise<boolean> \{/g, 
        "async function verifyCaptcha(token: string): Promise<boolean> {\n  if (process.env.NODE_ENV === 'development') return true;"
    );
    fs.writeFileSync('app/api/auth/route.ts', authApi, 'utf8');
}

// 2. Bypass in Login Route
let loginUI = fs.readFileSync('app/login/page.tsx', 'utf8');
loginUI = loginUI.replace(/if \(!captchaToken\)/g, "if (process.env.NODE_ENV !== 'development' && !captchaToken)");
loginUI = loginUI.replace(/<ReCAPTCHA/g, "{process.env.NODE_ENV !== 'development' && (\n                  <ReCAPTCHA");
loginUI = loginUI.replace(/theme=\{theme === 'dark' \? 'dark' : 'light'\}\s*\/>/g, "theme={theme === 'dark' ? 'dark' : 'light'}\n                  />\n                )}");
loginUI = loginUI.replace(/theme=\{theme === 'dark' \? 'dark' : 'light'\}\s*\}\s*\/>/g, "theme={theme === 'dark' ? 'dark' : 'light'}\n                  />\n                )}");
fs.writeFileSync('app/login/page.tsx', loginUI, 'utf8');

// 3. Bypass in Signup Route
let signupUI = fs.readFileSync('app/signup/page.tsx', 'utf8');
signupUI = signupUI.replace(/if \(!captchaToken\)/g, "if (process.env.NODE_ENV !== 'development' && !captchaToken)");
signupUI = signupUI.replace(/<ReCAPTCHA/g, "{process.env.NODE_ENV !== 'development' && (\n                  <ReCAPTCHA");
signupUI = signupUI.replace(/onChange=\{\(token\) => setCaptchaToken\(token\)\}\s*\/>/g, "onChange={(token) => setCaptchaToken(token)}\n                  />\n                )}");
fs.writeFileSync('app/signup/page.tsx', signupUI, 'utf8');

console.log('ReCaptcha successfully disabled strictly for localhost development environments.');
