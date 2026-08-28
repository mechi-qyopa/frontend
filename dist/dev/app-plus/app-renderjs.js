var __renderjsModules={};

__renderjsModules["18eb3192"] = (() => {
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __getOwnPropSymbols = Object.getOwnPropertySymbols;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __propIsEnum = Object.prototype.propertyIsEnumerable;
  var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
  var __spreadValues = (a, b) => {
    for (var prop in b || (b = {}))
      if (__hasOwnProp.call(b, prop))
        __defNormalProp(a, prop, b[prop]);
    if (__getOwnPropSymbols)
      for (var prop of __getOwnPropSymbols(b)) {
        if (__propIsEnum.call(b, prop))
          __defNormalProp(a, prop, b[prop]);
      }
    return a;
  };
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);
  var __async = (__this, __arguments, generator) => {
    return new Promise((resolve, reject) => {
      var fulfilled = (value) => {
        try {
          step(generator.next(value));
        } catch (e) {
          reject(e);
        }
      };
      var rejected = (value) => {
        try {
          step(generator.throw(value));
        } catch (e) {
          reject(e);
        }
      };
      var step = (x) => x.done ? resolve(x.value) : Promise.resolve(x.value).then(fulfilled, rejected);
      step((generator = generator.apply(__this, __arguments)).next());
    });
  };

  // <stdin>
  var stdin_exports = {};
  __export(stdin_exports, {
    default: () => stdin_default
  });
  var stdin_default = {
    data() {
      return { lastId: 0, controller: null };
    },
    methods: {
      onRequest(newVal, oldVal, ownerInstance) {
        if (!newVal)
          return;
        let request;
        try {
          request = JSON.parse(newVal);
        } catch (error) {
          return;
        }
        if (!request || !request.id || request.id === this.lastId)
          return;
        this.lastId = request.id;
        this.run(request, ownerInstance);
      },
      run(request, ownerInstance) {
        return __async(this, null, function* () {
          if (this.controller)
            this.controller.abort();
          const controller = new AbortController();
          this.controller = controller;
          const timeout = setTimeout(() => controller.abort(), 12e4);
          try {
            const response = yield fetch(request.url, {
              method: "POST",
              headers: __spreadValues({
                Accept: "text/event-stream",
                "Content-Type": "application/json"
              }, request.token ? { "X-App-Token": request.token } : {}),
              body: JSON.stringify(request.body),
              signal: controller.signal
            });
            if (response.status === 401) {
              clearTimeout(timeout);
              ownerInstance.callMethod("onStreamError", "UNAUTHORIZED");
              return;
            }
            if (!response.ok || !response.body) {
              const text = response.body ? yield response.text() : "";
              clearTimeout(timeout);
              ownerInstance.callMethod("onStreamError", text || `\u6D41\u5F0F\u8BF7\u6C42\u5931\u8D25(${response.status})`);
              return;
            }
            const reader = response.body.getReader();
            const decoder = new TextDecoder("utf-8");
            let buffer = "";
            while (true) {
              const { done, value } = yield reader.read();
              if (done)
                break;
              buffer += decoder.decode(value, { stream: true });
              buffer = this.consume(buffer, ownerInstance);
            }
            buffer += decoder.decode();
            if (buffer.trim())
              this.consume(`${buffer}

`, ownerInstance);
            clearTimeout(timeout);
            ownerInstance.callMethod("onStreamDone");
          } catch (error) {
            clearTimeout(timeout);
            if ((error == null ? void 0 : error.name) === "AbortError")
              ownerInstance.callMethod("onStreamError", "\u56DE\u590D\u8D85\u65F6\uFF0C\u8BF7\u91CD\u8BD5");
            else
              ownerInstance.callMethod("onStreamError", (error == null ? void 0 : error.message) || "\u5BF9\u8BDD\u8BF7\u6C42\u5931\u8D25");
          }
        });
      },
      consume(buffer, ownerInstance) {
        const events = buffer.split(/\r?\n\r?\n/);
        const remainder = events.pop();
        events.forEach((event) => {
          const token = event.split(/\r?\n/).filter((line) => line.startsWith("data:")).map((line) => line.slice(5).replace(/^ /, "")).join("\n");
          if (!token)
            return;
          if (token.startsWith("[ERROR]"))
            ownerInstance.callMethod("onStreamError", token.replace(/^\[ERROR\]\s*/, ""));
          else
            ownerInstance.callMethod("onStreamToken", token.replace(/\\n/g, "\n"));
        });
        return remainder;
      }
    }
  };
  return __toCommonJS(stdin_exports);
})();
