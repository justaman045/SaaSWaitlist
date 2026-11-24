// CommonJS shim: the Firebase emulator's script runner uses require(),
// which cannot load an ES module directly.
import("./setup-emulator-admin.mjs").catch((error) => {
    console.error(error)
    process.exit(1)
})
