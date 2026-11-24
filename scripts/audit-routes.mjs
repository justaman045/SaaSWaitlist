// Loads a list of routes in the browser and reports every console error,
// React warning and failed request for each one.
//
// Usage:
//   node scripts/audit-routes.mjs <baseUrl> <route,route,...> [--login email:password]
//
// With --login the audit signs in through the app's own sign-in form first,
// which is the only way to get a session the Firebase SDK actually accepts.
// The optional token-file mode is kept for reference but the form is more
// faithful to what a real visitor does.
import { readFileSync } from "node:fs"

const [, , baseUrl, routeList, ...options] = process.argv
const routes = routeList.split(",").map((route) => route.trim()).filter(Boolean)

const loginIndex = options.indexOf("--login")
const credentials =
    loginIndex === -1 ? null : options[loginIndex + 1]?.split(":") ?? null

const authFileIndex = options.indexOf("--token-file")
const auth =
    authFileIndex === -1 ? null : JSON.parse(readFileSync(options[authFileIndex + 1], "utf8"))

const CHROME = "/usr/bin/google-chrome"
const DEBUG_PORT = 9222

async function connect() {
    // Reuse a running Chrome instance if there is one, otherwise start one.
    const existing = await fetch(`http://127.0.0.1:${DEBUG_PORT}/json/version`).catch(() => null)
    if (existing?.ok) return existing.json()

    const { spawn } = await import("node:child_process")
    const child = spawn(
        CHROME,
        [
            "--headless=new",
            `--remote-debugging-port=${DEBUG_PORT}`,
            "--no-sandbox",
            "--disable-gpu",
            "--disable-dev-shm-usage",
            "--user-data-dir=/tmp/opencode/chrome-audit",
            "about:blank",
        ],
        { detached: true, stdio: "ignore" }
    )
    child.unref()

    for (let i = 0; i < 40; i += 1) {
        const response = await fetch(`http://127.0.0.1:${DEBUG_PORT}/json/version`).catch(() => null)
        if (response?.ok) return response.json()
        await new Promise((resolve) => setTimeout(resolve, 250))
    }
    throw new Error("could not start Chrome")
}

const version = await connect()
const { webSocketDebuggerUrl } = version
const { WebSocket } = await import("node:ws").then((m) => m.default ?? m).catch(() => ({ WebSocket: globalThis.WebSocket }))

const socket = new WebSocket(webSocketDebuggerUrl)
await new Promise((resolve, reject) => {
    socket.addEventListener("open", resolve, { once: true })
    socket.addEventListener("error", reject, { once: true })
})

let messageId = 0
const pending = new Map()
const listeners = []

socket.addEventListener("message", (event) => {
    const message = JSON.parse(event.data)
    if (message.id && pending.has(message.id)) {
        pending.get(message.id)(message)
        pending.delete(message.id)
        return
    }
    for (const listener of listeners) listener(message)
})

function send(method, params = {}, sessionId) {
    const id = ++messageId
    return new Promise((resolve) => {
        pending.set(id, resolve)
        socket.send(JSON.stringify({ id, method, params, sessionId }))
    })
}

for (const method of ["Runtime.enable", "Log.enable", "Network.enable", "Page.enable"]) {
    await send(method)
}

const results = []

/**
 * Writes a Firebase session into the browser's IndexedDB.
 *
 * The Firebase SDK persists the signed-in user under
 * `firebase:authUser:<apiKey>:[DEFAULT]` in the `firebaseLocalStorage`
 * object store, so writing that record is enough to sign the browser in.
 *
 * The record has to match `UserImpl.toJSON()` exactly. In particular
 * `stsTokenManager.expirationTime` is a **number** (milliseconds since the
 * epoch) — the SDK asserts on it and silently discards the session when it
 * is a string.
 */
async function injectSession(sessionId) {
    const now = Date.now()
    const user = {
        uid: auth.uid,
        email: auth.email,
        emailVerified: true,
        displayName: undefined,
        isAnonymous: false,
        photoURL: undefined,
        phoneNumber: undefined,
        tenantId: undefined,
        providerData: [],
        stsTokenManager: {
            refreshToken: auth.refreshToken,
            accessToken: auth.idToken,
            expirationTime: now + 3600000,
        },
        createdAt: new Date(now).toISOString(),
        lastLoginAt: new Date(now).toISOString(),
    }

    const expression = `(async () => {
        const KEY = ${JSON.stringify(`firebase:authUser:${auth.apiKey}:[DEFAULT]`)};
        const user = ${JSON.stringify(user)};
        const db = await new Promise((resolve, reject) => {
            const request = indexedDB.open('firebaseLocalStorageDb');
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
        await new Promise((resolve, reject) => {
            const tx = db.transaction('firebaseLocalStorage', 'readwrite');
            const store = tx.objectStore('firebaseLocalStorage');

            // Drop every session that is already stored. A stale session
            // makes the SDK call accounts:lookup with an expired token,
            // which answers 400 and shows up as a console error that has
            // nothing to do with the route under test.
            const existing = await new Promise((resolve, reject) => {
                const request = store.getAllKeys();
                request.onsuccess = () => resolve(request.result);
                request.onerror = () => reject(request.error);
            });
            for (const key of existing) {
                if (String(key).startsWith('firebase:authUser:')) store.delete(key);
            }

            store.put({ fbase_key: KEY, value: user });
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
        });
        return 'session injected';
    })()`

    const { result } = await send(
        "Runtime.evaluate",
        { expression, awaitPromise: true, returnByValue: true },
        sessionId
    )
    return result?.value ?? "unknown"
}

/**
 * Signs in through the app's own form.
 *
 * The inputs are React-controlled, so the native value setter plus an
 * `input` event is what makes React pick the value up.
 */
async function signIn(sessionId, email, password) {
    const expression = `(async () => {
        const setValue = (element, value) => {
            const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
            setter.call(element, value);
            element.dispatchEvent(new Event('input', { bubbles: true }));
        };
        const emailInput = document.querySelector('input[type=email]');
        const passwordInput = document.querySelector('input[type=password]');
        if (!emailInput || !passwordInput) return 'no login form';
        setValue(emailInput, ${JSON.stringify(email)});
        setValue(passwordInput, ${JSON.stringify(password)});
        document.querySelector('button[type=submit]').click();
        return 'submitted';
    })()`

    await send(
        "Runtime.evaluate",
        { expression, awaitPromise: true, returnByValue: true },
        sessionId
    )

    for (let i = 0; i < 20; i += 1) {
        await new Promise((resolve) => setTimeout(resolve, 1000))
        const { result } = await send(
            "Runtime.evaluate",
            {
                expression: `document.body.innerText.includes('Admin Dashboard')`,
                returnByValue: true,
            },
            sessionId
        )
        if (result?.result?.value) return true
    }
    return false
}

for (const route of routes) {
    const { result: target } = await send("Target.createTarget", { url: "about:blank" })
    const { result: attach } = await send("Target.attachToTarget", {
        targetId: target.targetId,
        flatten: true,
    })
    const sessionId = attach.sessionId

    for (const method of ["Runtime.enable", "Log.enable", "Network.enable", "Page.enable"]) {
        await send(method, {}, sessionId)
    }

    const messages = []
    // Maps a request id to its URL so a failed request can be named.
    const urlByRequestId = new Map()
    const collect = (message) => {
        if (message.sessionId !== sessionId) return
        const { method, params } = message

        if (method === "Network.requestWillBeSent") {
            urlByRequestId.set(params.requestId, params.request.url)
        }

        if (method === "Runtime.consoleAPICalled") {
            const text = (params.args ?? [])
                .map((arg) => arg.value ?? arg.description ?? arg.unserializableValue ?? "")
                .join(" ")
            if (params.type === "error" || params.type === "warning") {
                messages.push({ kind: `console.${params.type}`, text: text.slice(0, 400) })
            }
        }

        if (method === "Runtime.exceptionThrown") {
            const details = params.exceptionDetails
            messages.push({
                kind: "exception",
                text: (details.exception?.description ?? details.text ?? "").slice(0, 400),
            })
        }

        if (method === "Log.entryAdded") {
            const entry = params.entry
            if (entry.level === "error" || entry.level === "warning") {
                messages.push({ kind: `log.${entry.level}`, text: String(entry.text).slice(0, 400) })
            }
        }

        if (method === "Network.responseReceived") {
            const response = params.response
            if (response.status >= 400) {
                messages.push({
                    kind: "http",
                    text: `${response.status} ${response.url.slice(0, 160)}`,
                })
            }
        }

        if (method === "Network.loadingFailed") {
            const url = urlByRequestId.get(params.requestId) ?? "(unknown url)"

            // A long-lived streaming request (the Firestore listen channel)
            // is cancelled when the audit closes the tab. That is teardown
            // noise, not a defect, so it is reported separately.
            if (params.canceled && params.errorText === "net::ERR_ABORTED") {
                messages.push({
                    kind: "request-cancelled",
                    text: `${params.errorText} ${url.slice(0, 120)}`,
                })
                return
            }

            messages.push({
                kind: "request-failed",
                text: `${params.errorText} ${url.slice(0, 160)}`,
            })
        }
    }
    listeners.push(collect)

    if (credentials) {
        await send("Page.navigate", { url: `${baseUrl}/admin` }, sessionId)
        await new Promise((resolve) => setTimeout(resolve, 4000))
        const loggedIn = await signIn(sessionId, credentials[0], credentials[1])
        if (!loggedIn) {
            console.error(`could not sign in as ${credentials[0]} — aborting`)
            await send("Target.closeTarget", { targetId: target.targetId })
            process.exit(1)
        }
        // The sign-in page itself must not pollute the results.
        messages.length = 0
    }

    if (auth) {
        await send("Page.navigate", { url: baseUrl }, sessionId)
        await new Promise((resolve) => setTimeout(resolve, 3000))
        await injectSession(sessionId)
    }

    await send("Page.navigate", { url: `${baseUrl}${route}` }, sessionId)
    await new Promise((resolve) => setTimeout(resolve, 7000))

    const { result: evaluated } = await send(
        "Runtime.evaluate",
        {
            expression: `(() => {
                const text = document.body ? document.body.innerText : "";
                return JSON.stringify({
                    title: document.title,
                    textLength: text.length,
                    textStart: text.replace(/\\s+/g, " ").slice(0, 200)
                });
            })()`,
            returnByValue: true,
        },
        sessionId
    )

    let pageInfo = {}
    try {
        pageInfo = JSON.parse(evaluated.result.value)
    } catch {}

    results.push({ route, messages, pageInfo })
    listeners.splice(listeners.indexOf(collect), 1)
    await send("Target.closeTarget", { targetId: target.targetId })
}
console.log(JSON.stringify(results, null, 2))
socket.close()
process.exit(0)
