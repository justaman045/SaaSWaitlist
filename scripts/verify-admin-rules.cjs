// CommonJS shim: the Firebase emulator's script runner uses require(),
// which cannot load an ES module directly.
import("./verify-admin-rules.mjs").catch((error) => {
    console.error(error)
    process.exit(1)
})
