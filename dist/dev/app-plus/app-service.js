if (typeof Promise !== "undefined" && !Promise.prototype.finally) {
  Promise.prototype.finally = function(callback) {
    const promise = this.constructor;
    return this.then(
      (value) => promise.resolve(callback()).then(() => value),
      (reason) => promise.resolve(callback()).then(() => {
        throw reason;
      })
    );
  };
}
;
if (typeof uni !== "undefined" && uni && uni.requireGlobal) {
  const global2 = uni.requireGlobal();
  ArrayBuffer = global2.ArrayBuffer;
  Int8Array = global2.Int8Array;
  Uint8Array = global2.Uint8Array;
  Uint8ClampedArray = global2.Uint8ClampedArray;
  Int16Array = global2.Int16Array;
  Uint16Array = global2.Uint16Array;
  Int32Array = global2.Int32Array;
  Uint32Array = global2.Uint32Array;
  Float32Array = global2.Float32Array;
  Float64Array = global2.Float64Array;
  BigInt64Array = global2.BigInt64Array;
  BigUint64Array = global2.BigUint64Array;
}
;
if (uni.restoreGlobal) {
  uni.restoreGlobal(Vue, weex, plus, setTimeout, clearTimeout, setInterval, clearInterval);
}
(function(vue) {
  "use strict";
  const ON_SHOW = "onShow";
  const ON_LOAD = "onLoad";
  const createLifeCycleHook = (lifecycle, flag = 0) => (hook, target = vue.getCurrentInstance()) => {
    if (vue.isInSSRComponentSetup)
      return;
    vue.injectHook(lifecycle, hook, target);
  };
  const onShow = /* @__PURE__ */ createLifeCycleHook(
    ON_SHOW,
    2
    /* HookFlags.PAGE */
  );
  const onLoad = /* @__PURE__ */ createLifeCycleHook(
    ON_LOAD,
    2
    /* HookFlags.PAGE */
  );
  var define_import_meta_env_default = {};
  const API_BASE_URL = define_import_meta_env_default.VITE_API_BASE_URL || "http://10.10.0.147:7002";
  const APP_TOKEN_KEY = "mechi_app_token";
  const APP_PROFILE_KEY = "mechi_app_profile";
  const parseProfile = () => {
    const value = uni.getStorageSync(APP_PROFILE_KEY);
    if (!value)
      return null;
    try {
      return typeof value === "string" ? JSON.parse(value) : value;
    } catch {
      return null;
    }
  };
  const authStore = vue.reactive({
    token: "",
    profile: null,
    restore() {
      this.token = uni.getStorageSync(APP_TOKEN_KEY) || "";
      this.profile = parseProfile();
    },
    setLogin(token, profile) {
      this.token = token;
      this.profile = profile;
      uni.setStorageSync(APP_TOKEN_KEY, token);
      uni.setStorageSync(APP_PROFILE_KEY, JSON.stringify(profile));
    },
    setProfile(profile) {
      this.profile = profile;
      uni.setStorageSync(APP_PROFILE_KEY, JSON.stringify(profile));
    },
    clear() {
      this.token = "";
      this.profile = null;
      uni.removeStorageSync(APP_TOKEN_KEY);
      uni.removeStorageSync(APP_PROFILE_KEY);
    }
  });
  authStore.restore();
  function redirectToLogin$1() {
    var _a;
    authStore.clear();
    const pages = getCurrentPages();
    if (((_a = pages[pages.length - 1]) == null ? void 0 : _a.route) !== "pages/auth/login") {
      uni.reLaunch({ url: "/pages/auth/login" });
    }
  }
  function request({ url, method = "GET", data, unwrapResult = false, header = {} }) {
    return new Promise((resolve, reject) => {
      uni.request({
        url: `${API_BASE_URL}${url}`,
        method,
        data,
        header: {
          Accept: "application/json",
          ...data ? { "Content-Type": "application/json" } : {},
          ...authStore.token ? { "X-App-Token": authStore.token } : {},
          ...header
        },
        success: ({ statusCode, data: body }) => {
          if (statusCode === 401) {
            redirectToLogin$1();
            reject(new Error("登录已过期，请重新登录"));
            return;
          }
          if (statusCode < 200 || statusCode >= 300) {
            reject(new Error((body == null ? void 0 : body.msg) || (body == null ? void 0 : body.message) || "请求失败"));
            return;
          }
          if (unwrapResult) {
            if ((body == null ? void 0 : body.code) !== 0) {
              reject(new Error((body == null ? void 0 : body.msg) || "操作失败"));
              return;
            }
            resolve(body.data);
            return;
          }
          resolve(body);
        },
        fail: () => reject(new Error("网络连接失败，请检查服务地址"))
      });
    });
  }
  function showRequestError(error) {
    uni.showToast({ title: (error == null ? void 0 : error.message) || "操作失败", icon: "none", duration: 2200 });
  }
  function redirectToLogin() {
    var _a;
    authStore.clear();
    const pages = getCurrentPages();
    if (((_a = pages[pages.length - 1]) == null ? void 0 : _a.route) !== "pages/auth/login") {
      uni.reLaunch({ url: "/pages/auth/login" });
    }
  }
  function consumeSseEvents(buffer, onToken) {
    const events = buffer.split(/\r?\n\r?\n/);
    const remainder = events.pop();
    events.forEach((event) => {
      const token = event.split(/\r?\n/).filter((line) => line.startsWith("data:")).map((line) => line.slice(5).replace(/^ /, "")).join("\n");
      if (token)
        onToken(token.replace(/\\n/g, "\n"));
    });
    return remainder;
  }
  async function streamChat(data, onToken) {
    if (typeof fetch !== "function") {
      const response2 = await request({ url: "/api/v1/app/chat", method: "POST", data });
      if (!response2.success)
        throw new Error(response2.error || "暂时无法回复");
      onToken(response2.reply);
      return;
    }
    const response = await fetch(`${API_BASE_URL}/api/v1/app/chat/stream`, {
      method: "POST",
      headers: {
        Accept: "text/event-stream",
        "Content-Type": "application/json",
        ...authStore.token ? { "X-App-Token": authStore.token } : {}
      },
      body: JSON.stringify(data)
    });
    if (response.status === 401) {
      redirectToLogin();
      throw new Error("登录已过期，请重新登录");
    }
    if (!response.ok) {
      const message = await response.text();
      throw new Error(message || "流式请求失败");
    }
    if (!response.body)
      throw new Error("当前环境不支持流式响应");
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    while (true) {
      const { done, value } = await reader.read();
      buffer += decoder.decode(value || new Uint8Array(), { stream: !done });
      buffer = consumeSseEvents(buffer, onToken);
      if (done)
        break;
    }
    if (buffer.trim())
      consumeSseEvents(`${buffer}

`, onToken);
  }
  async function uploadImage(filePath) {
    return new Promise((resolve, reject) => {
      uni.uploadFile({
        url: `${API_BASE_URL}/api/v1/app/storage/images`,
        filePath,
        name: "file",
        header: {
          Accept: "application/json",
          ...authStore.token ? { "X-App-Token": authStore.token } : {}
        },
        success: ({ statusCode, data }) => {
          let body;
          try {
            body = typeof data === "string" ? JSON.parse(data) : data;
          } catch {
            body = null;
          }
          if (statusCode === 401) {
            redirectToLogin();
            reject(new Error("登录已过期，请重新登录"));
            return;
          }
          if (statusCode < 200 || statusCode >= 300 || !(body == null ? void 0 : body.url)) {
            reject(new Error((body == null ? void 0 : body.msg) || "头像上传失败"));
            return;
          }
          resolve(body.url);
        },
        fail: () => reject(new Error("头像上传失败，请检查网络连接"))
      });
    });
  }
  const appApi = {
    register: (data) => request({ url: "/api/v1/app/register", method: "POST", data }),
    login: (data) => request({ url: "/api/v1/app/login", method: "POST", data }),
    logout: () => request({ url: "/api/v1/app/logout", method: "POST" }),
    getMe: () => request({ url: "/api/v1/app/me" }),
    updateMe: (data) => request({ url: "/api/v1/app/me", method: "PATCH", data }),
    listCategories: () => request({ url: "/api/v1/app/bookkeeping/categories", unwrapResult: true }),
    createCategory: (data) => request({ url: "/api/v1/app/bookkeeping/categories", method: "POST", data, unwrapResult: true }),
    updateCategory: (id, data) => request({ url: `/api/v1/app/bookkeeping/categories/${id}`, method: "PATCH", data, unwrapResult: true }),
    deleteCategory: (id) => request({ url: `/api/v1/app/bookkeeping/categories/${id}`, method: "DELETE", unwrapResult: true }),
    listTransactions: (range) => request({ url: "/api/v1/app/bookkeeping/transactions", data: range, unwrapResult: true }),
    getSummary: (range) => request({ url: "/api/v1/app/bookkeeping/transactions/summary", data: range, unwrapResult: true }),
    getTransactionActivityStats: () => request({ url: "/api/v1/app/bookkeeping/transactions/activity-stats", unwrapResult: true }),
    createTransaction: (data) => request({ url: "/api/v1/app/bookkeeping/transactions", method: "POST", data, unwrapResult: true }),
    updateTransaction: (id, data) => request({ url: `/api/v1/app/bookkeeping/transactions/${id}`, method: "PATCH", data, unwrapResult: true }),
    deleteTransaction: (id) => request({ url: `/api/v1/app/bookkeeping/transactions/${id}`, method: "DELETE", unwrapResult: true }),
    chat: (data) => request({ url: "/api/v1/app/chat", method: "POST", data }),
    streamChat: (data, onToken) => streamChat(data, onToken),
    chatHistory: (sessionId) => request({ url: "/api/v1/app/chat/history", data: { sessionId } }),
    uploadImage,
    listCommands: () => request({ url: "/api/v1/app/command/list" })
  };
  const _export_sfc = (sfc, props) => {
    const target = sfc.__vccOpts || sfc;
    for (const [key, val] of props) {
      target[key] = val;
    }
    return target;
  };
  const _sfc_main$8 = {
    __name: "login",
    setup(__props, { expose: __expose }) {
      __expose();
      const form = vue.reactive({ username: "", password: "" });
      const submitting = vue.ref(false);
      onShow(() => {
        if (authStore.token)
          uni.switchTab({ url: "/pages/ledger/index" });
      });
      async function submit() {
        if (!form.username || !form.password)
          return uni.showToast({ title: "请输入用户名和密码", icon: "none" });
        submitting.value = true;
        try {
          const result = await appApi.login(form);
          authStore.setLogin(result.token, result.user);
          uni.switchTab({ url: "/pages/ledger/index" });
        } catch (error) {
          showRequestError(error);
        } finally {
          submitting.value = false;
        }
      }
      function goRegister() {
        uni.navigateTo({ url: "/pages/auth/register" });
      }
      const __returned__ = { form, submitting, submit, goRegister, reactive: vue.reactive, ref: vue.ref, get onShow() {
        return onShow;
      }, get appApi() {
        return appApi;
      }, get authStore() {
        return authStore;
      }, get showRequestError() {
        return showRequestError;
      } };
      Object.defineProperty(__returned__, "__isScriptSetup", { enumerable: false, value: true });
      return __returned__;
    }
  };
  function _sfc_render$7(_ctx, _cache, $props, $setup, $data, $options) {
    return vue.openBlock(), vue.createElementBlock("view", { class: "auth-page" }, [
      vue.createElementVNode("view", { class: "hero" }, [
        vue.createElementVNode("text", { class: "brand" }, "美记账"),
        vue.createElementVNode("text", { class: "subtitle" }, "记录每一笔，掌控每一天")
      ]),
      vue.createElementVNode("view", { class: "form-card" }, [
        vue.createElementVNode("text", { class: "title" }, "欢迎回来"),
        vue.withDirectives(vue.createElementVNode(
          "input",
          {
            "onUpdate:modelValue": _cache[0] || (_cache[0] = ($event) => $setup.form.username = $event),
            class: "input",
            placeholder: "用户名",
            maxlength: "32"
          },
          null,
          512
          /* NEED_PATCH */
        ), [
          [
            vue.vModelText,
            $setup.form.username,
            void 0,
            { trim: true }
          ]
        ]),
        vue.withDirectives(vue.createElementVNode(
          "input",
          {
            "onUpdate:modelValue": _cache[1] || (_cache[1] = ($event) => $setup.form.password = $event),
            class: "input form-space",
            placeholder: "密码",
            password: "",
            maxlength: "72"
          },
          null,
          512
          /* NEED_PATCH */
        ), [
          [vue.vModelText, $setup.form.password]
        ]),
        vue.createElementVNode("button", {
          class: "primary-button submit",
          loading: $setup.submitting,
          onClick: $setup.submit
        }, "登录", 8, ["loading"]),
        vue.createElementVNode("view", { class: "footer-text" }, [
          vue.createTextVNode("还没有账号？"),
          vue.createElementVNode("text", {
            class: "link",
            onClick: $setup.goRegister
          }, "立即注册")
        ])
      ])
    ]);
  }
  const PagesAuthLogin = /* @__PURE__ */ _export_sfc(_sfc_main$8, [["render", _sfc_render$7], ["__scopeId", "data-v-6c56cc25"], ["__file", "D:/code/mechiBookkeeping/frontend/src/pages/auth/login.vue"]]);
  const _sfc_main$7 = {
    __name: "register",
    setup(__props, { expose: __expose }) {
      __expose();
      const form = vue.reactive({ username: "", phone: "", password: "" });
      const confirmPassword = vue.ref("");
      const submitting = vue.ref(false);
      async function submit() {
        if (!/^[A-Za-z0-9_]{3,32}$/.test(form.username))
          return uni.showToast({ title: "用户名格式不正确", icon: "none" });
        if (!/^1\d{10}$/.test(form.phone))
          return uni.showToast({ title: "请输入正确的手机号", icon: "none" });
        if (form.password.length < 8)
          return uni.showToast({ title: "密码至少 8 位", icon: "none" });
        if (form.password !== confirmPassword.value)
          return uni.showToast({ title: "两次密码不一致", icon: "none" });
        submitting.value = true;
        try {
          await appApi.register(form);
          uni.showToast({ title: "注册成功，请登录", icon: "success" });
          setTimeout(() => uni.navigateBack(), 600);
        } catch (error) {
          showRequestError(error);
        } finally {
          submitting.value = false;
        }
      }
      function goLogin() {
        uni.navigateBack();
      }
      const __returned__ = { form, confirmPassword, submitting, submit, goLogin, reactive: vue.reactive, ref: vue.ref, get appApi() {
        return appApi;
      }, get showRequestError() {
        return showRequestError;
      } };
      Object.defineProperty(__returned__, "__isScriptSetup", { enumerable: false, value: true });
      return __returned__;
    }
  };
  function _sfc_render$6(_ctx, _cache, $props, $setup, $data, $options) {
    return vue.openBlock(), vue.createElementBlock("view", { class: "auth-page" }, [
      vue.createElementVNode("view", { class: "hero" }, [
        vue.createElementVNode("text", { class: "brand" }, "创建账号"),
        vue.createElementVNode("text", { class: "subtitle" }, "开始你的轻松记账之旅")
      ]),
      vue.createElementVNode("view", { class: "form-card" }, [
        vue.withDirectives(vue.createElementVNode(
          "input",
          {
            "onUpdate:modelValue": _cache[0] || (_cache[0] = ($event) => $setup.form.username = $event),
            class: "input",
            placeholder: "用户名（3-32 位字母、数字或下划线）",
            maxlength: "32"
          },
          null,
          512
          /* NEED_PATCH */
        ), [
          [
            vue.vModelText,
            $setup.form.username,
            void 0,
            { trim: true }
          ]
        ]),
        vue.withDirectives(vue.createElementVNode(
          "input",
          {
            "onUpdate:modelValue": _cache[1] || (_cache[1] = ($event) => $setup.form.phone = $event),
            class: "input form-space",
            type: "number",
            placeholder: "手机号",
            maxlength: "11"
          },
          null,
          512
          /* NEED_PATCH */
        ), [
          [vue.vModelText, $setup.form.phone]
        ]),
        vue.withDirectives(vue.createElementVNode(
          "input",
          {
            "onUpdate:modelValue": _cache[2] || (_cache[2] = ($event) => $setup.form.password = $event),
            class: "input form-space",
            placeholder: "密码（至少 8 位）",
            password: "",
            maxlength: "72"
          },
          null,
          512
          /* NEED_PATCH */
        ), [
          [vue.vModelText, $setup.form.password]
        ]),
        vue.withDirectives(vue.createElementVNode(
          "input",
          {
            "onUpdate:modelValue": _cache[3] || (_cache[3] = ($event) => $setup.confirmPassword = $event),
            class: "input form-space",
            placeholder: "确认密码",
            password: "",
            maxlength: "72"
          },
          null,
          512
          /* NEED_PATCH */
        ), [
          [vue.vModelText, $setup.confirmPassword]
        ]),
        vue.createElementVNode("button", {
          class: "primary-button submit",
          loading: $setup.submitting,
          onClick: $setup.submit
        }, "注册", 8, ["loading"]),
        vue.createElementVNode("view", { class: "footer-text" }, [
          vue.createTextVNode("已有账号？"),
          vue.createElementVNode("text", {
            class: "link",
            onClick: $setup.goLogin
          }, "返回登录")
        ])
      ])
    ]);
  }
  const PagesAuthRegister = /* @__PURE__ */ _export_sfc(_sfc_main$7, [["render", _sfc_render$6], ["__scopeId", "data-v-3d5ab0d5"], ["__file", "D:/code/mechiBookkeeping/frontend/src/pages/auth/register.vue"]]);
  function formatDate(date) {
    const value = date instanceof Date ? date : new Date(date);
    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, "0");
    const day = String(value.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }
  function monthRange(date = /* @__PURE__ */ new Date()) {
    const start = new Date(date.getFullYear(), date.getMonth(), 1);
    const end = new Date(date.getFullYear(), date.getMonth() + 1, 0);
    return { startDate: formatDate(start), endDate: formatDate(end) };
  }
  function yearRange(year) {
    return { startDate: formatDate(new Date(year, 0, 1)), endDate: formatDate(new Date(year, 11, 31)) };
  }
  function weekRange(date = /* @__PURE__ */ new Date()) {
    const value = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const offset = (value.getDay() + 6) % 7;
    value.setDate(value.getDate() - offset);
    const end = new Date(value.getFullYear(), value.getMonth(), value.getDate() + 6);
    return { startDate: formatDate(value), endDate: formatDate(end) };
  }
  function weekRangesInMonth(year, monthIndex) {
    const monthStart = new Date(year, monthIndex, 1);
    const monthEnd = new Date(year, monthIndex + 1, 0);
    const firstWeek = weekRange(monthStart);
    const cursor = new Date(Number(firstWeek.startDate.slice(0, 4)), Number(firstWeek.startDate.slice(5, 7)) - 1, Number(firstWeek.startDate.slice(8, 10)));
    const weeks = [];
    while (cursor <= monthEnd) {
      const range = weekRange(cursor);
      weeks.push(range);
      cursor.setDate(cursor.getDate() + 7);
    }
    return weeks;
  }
  function formatAmount(value) {
    return Number(value || 0).toFixed(2);
  }
  const _sfc_main$6 = {
    __name: "index",
    setup(__props, { expose: __expose }) {
      __expose();
      const range = vue.reactive(monthRange());
      const summary = vue.reactive({ incomeTotal: 0, expenseTotal: 0, netAmount: 0 });
      const categories = vue.ref([]);
      const transactions = vue.ref([]);
      const loading = vue.ref(false);
      const pickerVisible = vue.ref(false);
      const pickerMode = vue.ref("MONTH");
      const pickerYear = vue.ref((/* @__PURE__ */ new Date()).getFullYear());
      const pickerMonth = vue.ref((/* @__PURE__ */ new Date()).getMonth());
      const periodType = vue.ref("MONTH");
      const pickerModes = [{ value: "WEEK", label: "按周" }, { value: "MONTH", label: "按月" }, { value: "YEAR", label: "按年" }];
      const months = Array.from({ length: 12 }, (_, index) => ({ value: index, label: `${index + 1}月` }));
      const weekdayLabels = ["日", "一", "二", "三", "四", "五", "六"];
      let requestId = 0;
      const categoryMap = vue.computed(() => new Map(categories.value.map((item) => [`${item.source}:${item.id}`, item.name])));
      const transactionGroups = vue.computed(() => {
        const groups = /* @__PURE__ */ new Map();
        transactions.value.forEach((item) => {
          if (!groups.has(item.occurredOn))
            groups.set(item.occurredOn, []);
          groups.get(item.occurredOn).push(item);
        });
        return Array.from(groups, ([date, items]) => ({ date, items, label: formatDayLabel(date) }));
      });
      const years = vue.computed(() => Array.from({ length: 12 }, (_, index) => pickerYear.value - 11 + index));
      const weeks = vue.computed(() => weekRangesInMonth(pickerYear.value, pickerMonth.value));
      const pickerHeading = vue.computed(() => pickerMode.value === "WEEK" ? `${pickerYear.value}年${pickerMonth.value + 1}月` : `${pickerYear.value}年`);
      const periodTitle = vue.computed(() => {
        if (periodType.value === "YEAR")
          return `${range.startDate.slice(0, 4)}年账本`;
        if (periodType.value === "MONTH")
          return `${range.startDate.slice(0, 4)}年${Number(range.startDate.slice(5, 7))}月账本`;
        return `${range.startDate.slice(5)} 至 ${range.endDate.slice(5)}`;
      });
      onShow(load);
      async function load() {
        const currentRequest = ++requestId;
        loading.value = true;
        try {
          const [categoryData, transactionData, summaryData] = await Promise.all([appApi.listCategories(), appApi.listTransactions(range), appApi.getSummary(range)]);
          if (currentRequest !== requestId)
            return;
          categories.value = categoryData;
          transactions.value = transactionData;
          Object.assign(summary, summaryData);
        } catch (error) {
          if (currentRequest === requestId)
            showRequestError(error);
        } finally {
          if (currentRequest === requestId)
            loading.value = false;
        }
      }
      function dateParts(dateString) {
        return { year: Number(dateString.slice(0, 4)), month: Number(dateString.slice(5, 7)) - 1, day: Number(dateString.slice(8, 10)) };
      }
      function formatDayLabel(dateString) {
        const { year, month, day } = dateParts(dateString);
        return `${month + 1}月${day}日 星期${weekdayLabels[new Date(year, month, day).getDay()]}`;
      }
      function openPicker() {
        const date = dateParts(range.startDate);
        pickerYear.value = date.year;
        pickerMonth.value = date.month;
        pickerMode.value = periodType.value;
        pickerVisible.value = true;
      }
      function closePicker() {
        pickerVisible.value = false;
      }
      function previousPicker() {
        if (pickerMode.value === "WEEK") {
          const previous = new Date(pickerYear.value, pickerMonth.value - 1, 1);
          pickerYear.value = previous.getFullYear();
          pickerMonth.value = previous.getMonth();
        } else
          pickerYear.value -= 1;
      }
      function nextPicker() {
        if (pickerMode.value === "WEEK") {
          const next = new Date(pickerYear.value, pickerMonth.value + 1, 1);
          pickerYear.value = next.getFullYear();
          pickerMonth.value = next.getMonth();
        } else
          pickerYear.value += 1;
      }
      async function commitRange(type, nextRange) {
        periodType.value = type;
        Object.assign(range, nextRange);
        pickerVisible.value = false;
        await load();
      }
      function selectMonth(month) {
        commitRange("MONTH", monthRange(new Date(pickerYear.value, month, 1)));
      }
      function selectYear(year) {
        commitRange("YEAR", yearRange(year));
      }
      function selectWeek(week) {
        commitRange("WEEK", week);
      }
      function isActiveMonth(month) {
        return periodType.value === "MONTH" && range.startDate === monthRange(new Date(pickerYear.value, month, 1)).startDate;
      }
      function isActiveYear(year) {
        return periodType.value === "YEAR" && range.startDate === yearRange(year).startDate;
      }
      function isActiveWeek(week) {
        return periodType.value === "WEEK" && range.startDate === week.startDate;
      }
      function weekLabel(week) {
        const start = dateParts(week.startDate);
        const end = dateParts(week.endDate);
        return `${start.month + 1}月${start.day}日 - ${end.month + 1}月${end.day}日`;
      }
      function categoryName(item) {
        const id = item.categorySource === "SYSTEM" ? item.systemCategoryId : item.categoryId;
        return categoryMap.value.get(`${item.categorySource || "CUSTOM"}:${id}`) || "分类已停用或删除";
      }
      function goCreate() {
        uni.navigateTo({ url: "/pages/ledger/transaction-form" });
      }
      function goStatistics() {
        uni.navigateTo({ url: "/pages/ledger/expense-statistics" });
      }
      function remove2(item) {
        uni.showModal({ title: "删除流水", content: "删除后无法恢复，确定继续吗？", success: async ({ confirm }) => {
          if (!confirm)
            return;
          try {
            await appApi.deleteTransaction(item.id);
            await load();
            uni.showToast({ title: "已删除", icon: "success" });
          } catch (error) {
            showRequestError(error);
          }
        } });
      }
      const __returned__ = { range, summary, categories, transactions, loading, pickerVisible, pickerMode, pickerYear, pickerMonth, periodType, pickerModes, months, weekdayLabels, get requestId() {
        return requestId;
      }, set requestId(v) {
        requestId = v;
      }, categoryMap, transactionGroups, years, weeks, pickerHeading, periodTitle, load, dateParts, formatDayLabel, openPicker, closePicker, previousPicker, nextPicker, commitRange, selectMonth, selectYear, selectWeek, isActiveMonth, isActiveYear, isActiveWeek, weekLabel, categoryName, goCreate, goStatistics, remove: remove2, computed: vue.computed, reactive: vue.reactive, ref: vue.ref, get onShow() {
        return onShow;
      }, get appApi() {
        return appApi;
      }, get formatAmount() {
        return formatAmount;
      }, get monthRange() {
        return monthRange;
      }, get weekRangesInMonth() {
        return weekRangesInMonth;
      }, get yearRange() {
        return yearRange;
      }, get showRequestError() {
        return showRequestError;
      } };
      Object.defineProperty(__returned__, "__isScriptSetup", { enumerable: false, value: true });
      return __returned__;
    }
  };
  function _sfc_render$5(_ctx, _cache, $props, $setup, $data, $options) {
    return vue.openBlock(), vue.createElementBlock("view", null, [
      vue.createElementVNode("view", {
        class: "range-bar",
        onClick: $setup.openPicker
      }, [
        vue.createElementVNode("view", null, [
          vue.createElementVNode(
            "text",
            { class: "range-title" },
            vue.toDisplayString($setup.periodTitle),
            1
            /* TEXT */
          ),
          vue.createElementVNode(
            "text",
            { class: "range-detail" },
            vue.toDisplayString($setup.range.startDate) + " 至 " + vue.toDisplayString($setup.range.endDate),
            1
            /* TEXT */
          )
        ]),
        vue.createElementVNode("view", { class: "range-actions" }, [
          vue.createElementVNode("text", {
            class: "statistics-link",
            onClick: vue.withModifiers($setup.goStatistics, ["stop"])
          }, "统计"),
          vue.createElementVNode("text", { class: "range-arrow" }, "⌄")
        ])
      ]),
      vue.createElementVNode("view", { class: "summary-card" }, [
        vue.createElementVNode("view", null, [
          vue.createElementVNode("text", { class: "summary-label" }, "收入"),
          vue.createElementVNode(
            "text",
            { class: "income" },
            "+" + vue.toDisplayString($setup.formatAmount($setup.summary.incomeTotal)),
            1
            /* TEXT */
          )
        ]),
        vue.createElementVNode("view", null, [
          vue.createElementVNode("text", { class: "summary-label" }, "支出"),
          vue.createElementVNode(
            "text",
            { class: "expense" },
            "-" + vue.toDisplayString($setup.formatAmount($setup.summary.expenseTotal)),
            1
            /* TEXT */
          )
        ]),
        vue.createElementVNode("view", null, [
          vue.createElementVNode("text", { class: "summary-label" }, "结余"),
          vue.createElementVNode(
            "text",
            { class: "balance" },
            vue.toDisplayString($setup.formatAmount($setup.summary.netAmount)),
            1
            /* TEXT */
          )
        ])
      ]),
      vue.createElementVNode("view", { class: "list-title" }, [
        vue.createTextVNode("流水明细 "),
        vue.createElementVNode(
          "text",
          { class: "muted" },
          vue.toDisplayString($setup.transactions.length) + " 笔",
          1
          /* TEXT */
        )
      ]),
      $setup.loading ? (vue.openBlock(), vue.createElementBlock("view", {
        key: 0,
        class: "empty"
      }, "加载中…")) : !$setup.transactions.length ? (vue.openBlock(), vue.createElementBlock("view", {
        key: 1,
        class: "empty"
      }, "这个时间段还没有流水")) : (vue.openBlock(), vue.createElementBlock("view", {
        key: 2,
        class: "day-groups"
      }, [
        (vue.openBlock(true), vue.createElementBlock(
          vue.Fragment,
          null,
          vue.renderList($setup.transactionGroups, (group) => {
            return vue.openBlock(), vue.createElementBlock("view", {
              key: group.date,
              class: "day-group"
            }, [
              vue.createElementVNode("view", { class: "day-header" }, [
                vue.createElementVNode(
                  "text",
                  { class: "day-label" },
                  vue.toDisplayString(group.label),
                  1
                  /* TEXT */
                ),
                vue.createElementVNode(
                  "text",
                  { class: "day-date" },
                  vue.toDisplayString(group.date),
                  1
                  /* TEXT */
                )
              ]),
              vue.createElementVNode("view", { class: "transaction-list" }, [
                (vue.openBlock(true), vue.createElementBlock(
                  vue.Fragment,
                  null,
                  vue.renderList(group.items, (item) => {
                    return vue.openBlock(), vue.createElementBlock("view", {
                      key: item.id,
                      class: "transaction-item"
                    }, [
                      vue.createElementVNode(
                        "view",
                        {
                          class: vue.normalizeClass(["icon", item.transactionType === "INCOME" ? "income-bg" : "expense-bg"])
                        },
                        vue.toDisplayString(item.transactionType === "INCOME" ? "收" : "支"),
                        3
                        /* TEXT, CLASS */
                      ),
                      vue.createElementVNode("view", { class: "item-main" }, [
                        vue.createElementVNode(
                          "text",
                          { class: "item-name" },
                          vue.toDisplayString($setup.categoryName(item)),
                          1
                          /* TEXT */
                        ),
                        vue.createElementVNode(
                          "text",
                          { class: "item-note" },
                          vue.toDisplayString(item.note || "暂无备注"),
                          1
                          /* TEXT */
                        )
                      ]),
                      vue.createElementVNode("view", { class: "item-right" }, [
                        vue.createElementVNode(
                          "text",
                          {
                            class: vue.normalizeClass(item.transactionType === "INCOME" ? "income" : "expense")
                          },
                          vue.toDisplayString(item.transactionType === "INCOME" ? "+" : "-") + vue.toDisplayString($setup.formatAmount(item.amount)),
                          3
                          /* TEXT, CLASS */
                        )
                      ]),
                      vue.createElementVNode("text", {
                        class: "delete",
                        onClick: vue.withModifiers(($event) => $setup.remove(item), ["stop"])
                      }, "删除", 8, ["onClick"])
                    ]);
                  }),
                  128
                  /* KEYED_FRAGMENT */
                ))
              ])
            ]);
          }),
          128
          /* KEYED_FRAGMENT */
        ))
      ])),
      vue.createElementVNode("view", {
        class: "add-fab",
        onClick: $setup.goCreate
      }, [
        vue.createElementVNode("text", null, "+")
      ]),
      $setup.pickerVisible ? (vue.openBlock(), vue.createElementBlock("view", {
        key: 3,
        class: "picker-mask",
        onClick: vue.withModifiers($setup.closePicker, ["self"])
      }, [
        vue.createElementVNode("view", { class: "date-picker" }, [
          vue.createElementVNode("view", { class: "picker-handle" }),
          vue.createElementVNode("view", { class: "picker-tabs" }, [
            (vue.openBlock(), vue.createElementBlock(
              vue.Fragment,
              null,
              vue.renderList($setup.pickerModes, (mode) => {
                return vue.createElementVNode("text", {
                  key: mode.value,
                  class: vue.normalizeClass(["picker-tab", { active: $setup.pickerMode === mode.value }]),
                  onClick: ($event) => $setup.pickerMode = mode.value
                }, vue.toDisplayString(mode.label), 11, ["onClick"]);
              }),
              64
              /* STABLE_FRAGMENT */
            ))
          ]),
          vue.createElementVNode("view", { class: "picker-nav" }, [
            vue.createElementVNode("text", {
              class: "nav-button",
              onClick: $setup.previousPicker
            }, "‹"),
            vue.createElementVNode(
              "text",
              { class: "picker-heading" },
              vue.toDisplayString($setup.pickerHeading),
              1
              /* TEXT */
            ),
            vue.createElementVNode("text", {
              class: "nav-button",
              onClick: $setup.nextPicker
            }, "›")
          ]),
          $setup.pickerMode === "MONTH" ? (vue.openBlock(), vue.createElementBlock("view", {
            key: 0,
            class: "date-grid month-grid"
          }, [
            (vue.openBlock(true), vue.createElementBlock(
              vue.Fragment,
              null,
              vue.renderList($setup.months, (month) => {
                return vue.openBlock(), vue.createElementBlock("text", {
                  key: month.value,
                  class: vue.normalizeClass(["date-cell", { active: $setup.isActiveMonth(month.value) }]),
                  onClick: ($event) => $setup.selectMonth(month.value)
                }, vue.toDisplayString(month.label), 11, ["onClick"]);
              }),
              128
              /* KEYED_FRAGMENT */
            ))
          ])) : $setup.pickerMode === "YEAR" ? (vue.openBlock(), vue.createElementBlock("view", {
            key: 1,
            class: "date-grid year-grid"
          }, [
            (vue.openBlock(true), vue.createElementBlock(
              vue.Fragment,
              null,
              vue.renderList($setup.years, (year) => {
                return vue.openBlock(), vue.createElementBlock("text", {
                  key: year,
                  class: vue.normalizeClass(["date-cell", { active: $setup.isActiveYear(year) }]),
                  onClick: ($event) => $setup.selectYear(year)
                }, vue.toDisplayString(year), 11, ["onClick"]);
              }),
              128
              /* KEYED_FRAGMENT */
            ))
          ])) : (vue.openBlock(), vue.createElementBlock("view", {
            key: 2,
            class: "week-list"
          }, [
            (vue.openBlock(true), vue.createElementBlock(
              vue.Fragment,
              null,
              vue.renderList($setup.weeks, (week) => {
                return vue.openBlock(), vue.createElementBlock("view", {
                  key: week.startDate,
                  class: vue.normalizeClass(["week-cell", { active: $setup.isActiveWeek(week) }]),
                  onClick: ($event) => $setup.selectWeek(week)
                }, [
                  vue.createElementVNode(
                    "text",
                    null,
                    vue.toDisplayString($setup.weekLabel(week)),
                    1
                    /* TEXT */
                  ),
                  vue.createElementVNode(
                    "text",
                    null,
                    vue.toDisplayString(week.startDate) + " 至 " + vue.toDisplayString(week.endDate),
                    1
                    /* TEXT */
                  )
                ], 10, ["onClick"]);
              }),
              128
              /* KEYED_FRAGMENT */
            ))
          ]))
        ])
      ])) : vue.createCommentVNode("v-if", true)
    ]);
  }
  const PagesLedgerIndex = /* @__PURE__ */ _export_sfc(_sfc_main$6, [["render", _sfc_render$5], ["__scopeId", "data-v-43fd4b50"], ["__file", "D:/code/mechiBookkeeping/frontend/src/pages/ledger/index.vue"]]);
  const _sfc_main$5 = {
    __name: "expense-statistics",
    setup(__props, { expose: __expose }) {
      __expose();
      const range = vue.reactive(monthRange());
      const periodType = vue.ref("MONTH");
      const pickerVisible = vue.ref(false);
      const pickerMode = vue.ref("MONTH");
      const pickerYear = vue.ref((/* @__PURE__ */ new Date()).getFullYear());
      const pickerMonth = vue.ref((/* @__PURE__ */ new Date()).getMonth());
      const loading = vue.ref(false);
      const trendData = vue.ref([]);
      const categoryStats = vue.ref([]);
      const expenseTotal = vue.ref(0);
      const expenseTransactions = vue.ref(0);
      const periodOptions = [{ value: "WEEK", label: "周" }, { value: "MONTH", label: "月" }, { value: "YEAR", label: "年" }, { value: "CUSTOM", label: "自定义" }];
      const pickerModes = [{ value: "WEEK", label: "按周" }, { value: "MONTH", label: "按月" }, { value: "YEAR", label: "按年" }];
      const months = Array.from({ length: 12 }, (_, index) => ({ value: index, label: `${index + 1}月` }));
      const pieColors = ["#1677ff", "#69a7ff", "#9cc4ff", "#5c9dff", "#7aaef7", "#b9d5ff"];
      const screenWidth = uni.getSystemInfoSync().windowWidth || 375;
      const trendPlotWidth = screenWidth * 566 / 750;
      const trendPlotHeight = screenWidth * 184 / 750;
      const trendPlotPadding = screenWidth * 12 / 750;
      let requestId = 0;
      const years = vue.computed(() => Array.from({ length: 12 }, (_, index) => pickerYear.value - 11 + index));
      const weeks = vue.computed(() => weekRangesInMonth(pickerYear.value, pickerMonth.value));
      const pickerHeading = vue.computed(() => pickerMode.value === "WEEK" ? `${pickerYear.value}年${pickerMonth.value + 1}月` : `${pickerYear.value}年`);
      const periodTitle = vue.computed(() => periodType.value === "WEEK" ? "按周费用统计" : periodType.value === "YEAR" ? `${range.startDate.slice(0, 4)}年费用统计` : `${range.startDate.slice(0, 4)}年${Number(range.startDate.slice(5, 7))}月费用统计`);
      const trendUnitLabel = vue.computed(() => periodType.value === "YEAR" ? "按月" : "按日");
      const peakAmount = vue.computed(() => Math.max(0, ...trendData.value.map((item) => item.amount)));
      const averageExpense = vue.computed(() => expenseTotal.value / Math.max(1, trendData.value.length));
      const trendPoints = vue.computed(() => {
        const data = trendData.value;
        const max = Math.max(1, ...data.map((item) => item.amount));
        const innerWidth = Math.max(1, trendPlotWidth - trendPlotPadding * 2);
        const innerHeight = Math.max(1, trendPlotHeight - trendPlotPadding * 2);
        return data.map((item, index) => {
          const ratio = data.length === 1 ? 0.5 : index / (data.length - 1);
          const x = trendPlotPadding + innerWidth * ratio;
          const y = trendPlotPadding + innerHeight * item.amount / max;
          return { key: item.key, label: item.label, x, y, style: { left: `${x}px`, bottom: `${y}px` }, labelStyle: { left: `${x / trendPlotWidth * 100}%` } };
        });
      });
      const trendSegments = vue.computed(() => trendPoints.value.slice(1).map((point, index) => {
        const previous = trendPoints.value[index];
        const dx = point.x - previous.x;
        const dy = previous.y - point.y;
        const length = Math.sqrt(dx * dx + dy * dy);
        const angle = Math.atan2(dy, dx) * 180 / Math.PI;
        return { key: `${previous.key}-${point.key}`, style: { left: `${previous.x}px`, bottom: `${previous.y}px`, width: `${length}px`, transform: `translateY(50%) rotate(${angle}deg)` } };
      }));
      const trendLabelPoints = vue.computed(() => {
        const points = trendPoints.value;
        if (!points.length)
          return [];
        const type = periodType.value;
        if (type === "WEEK" || type === "YEAR")
          return points;
        if (type === "CUSTOM") {
          const start = parseDate(range.startDate);
          const end = parseDate(range.endDate);
          const totalDays = Math.round((end - start) / 864e5) + 1;
          if (totalDays > 31)
            return points;
          return points.filter((_, index) => index % 5 === 0);
        }
        return points.filter((_, index) => index % 5 === 0);
      });
      const pieChartStyle = vue.computed(() => {
        if (categoryStats.value.length <= 1)
          return {};
        let offset = 0;
        const segments = categoryStats.value.map((item, index) => {
          const start = offset;
          offset += item.percent;
          return `${pieColor(index)} ${start}% ${offset}%`;
        });
        return { background: `conic-gradient(${segments.join(", ")})` };
      });
      onLoad(load);
      async function load() {
        const currentRequest = ++requestId;
        loading.value = true;
        try {
          const [categories, transactions] = await Promise.all([appApi.listCategories(), appApi.listTransactions(range)]);
          if (currentRequest !== requestId)
            return;
          const result = aggregateExpenses(transactions, categories, range, periodType.value);
          trendData.value = result.trend;
          categoryStats.value = result.categories;
          expenseTotal.value = result.total;
          expenseTransactions.value = result.count;
        } catch (error) {
          if (currentRequest === requestId)
            showRequestError(error);
        } finally {
          if (currentRequest === requestId)
            loading.value = false;
        }
      }
      function setPeriodType(type) {
        if (type === periodType.value)
          return;
        if (type === "CUSTOM") {
          periodType.value = type;
          load();
          return;
        }
        const now = /* @__PURE__ */ new Date();
        if (type === "WEEK")
          commitRange(type, weekRange(now));
        if (type === "MONTH")
          commitRange(type, monthRange(now));
        if (type === "YEAR")
          commitRange(type, yearRange(now.getFullYear()));
      }
      function openPicker() {
        const date = parseDate(range.startDate);
        pickerYear.value = date.getFullYear();
        pickerMonth.value = date.getMonth();
        pickerMode.value = periodType.value;
        pickerVisible.value = true;
      }
      function closePicker() {
        pickerVisible.value = false;
      }
      function previousPicker() {
        if (pickerMode.value === "WEEK") {
          const previous = new Date(pickerYear.value, pickerMonth.value - 1, 1);
          pickerYear.value = previous.getFullYear();
          pickerMonth.value = previous.getMonth();
        } else
          pickerYear.value -= 1;
      }
      function nextPicker() {
        if (pickerMode.value === "WEEK") {
          const next = new Date(pickerYear.value, pickerMonth.value + 1, 1);
          pickerYear.value = next.getFullYear();
          pickerMonth.value = next.getMonth();
        } else
          pickerYear.value += 1;
      }
      function commitRange(type, nextRange) {
        periodType.value = type;
        Object.assign(range, nextRange);
        pickerVisible.value = false;
        load();
      }
      function selectMonth(month) {
        commitRange("MONTH", monthRange(new Date(pickerYear.value, month, 1)));
      }
      function selectYear(year) {
        commitRange("YEAR", yearRange(year));
      }
      function selectWeek(week) {
        commitRange("WEEK", week);
      }
      function isActiveMonth(month) {
        return periodType.value === "MONTH" && range.startDate === monthRange(new Date(pickerYear.value, month, 1)).startDate;
      }
      function isActiveYear(year) {
        return periodType.value === "YEAR" && range.startDate === yearRange(year).startDate;
      }
      function isActiveWeek(week) {
        return periodType.value === "WEEK" && range.startDate === week.startDate;
      }
      function weekLabel(week) {
        const start = parseDate(week.startDate);
        const end = parseDate(week.endDate);
        return `${start.getMonth() + 1}月${start.getDate()}日 - ${end.getMonth() + 1}月${end.getDate()}日`;
      }
      function selectCustomStart(event) {
        const startDate = event.detail.value;
        if (startDate > range.endDate)
          return uni.showToast({ title: "开始日期不能晚于结束日期", icon: "none" });
        range.startDate = startDate;
        load();
      }
      function selectCustomEnd(event) {
        const endDate = event.detail.value;
        if (endDate < range.startDate)
          return uni.showToast({ title: "结束日期不能早于开始日期", icon: "none" });
        range.endDate = endDate;
        load();
      }
      function aggregateExpenses(transactions, categories, selectedRange, type) {
        const trend = createTrendBuckets(selectedRange, type);
        const trendMap = new Map(trend.map((item) => [item.key, item]));
        const categoryNames = new Map(categories.map((item) => [`${item.source}:${item.id}`, item.name]));
        const categoryMap = /* @__PURE__ */ new Map();
        let totalCents = 0;
        let count = 0;
        transactions.filter((item) => item.transactionType === "EXPENSE").forEach((item) => {
          const cents = Math.round(Number(item.amount || 0) * 100);
          if (cents <= 0)
            return;
          const trendKey = resolveTrendKey(item.occurredOn, type, selectedRange, trend);
          const bucket = trendMap.get(trendKey);
          if (bucket)
            bucket.cents += cents;
          const categoryId = item.categorySource === "SYSTEM" ? item.systemCategoryId : item.categoryId;
          const key = `${item.categorySource || "CUSTOM"}:${categoryId || "unknown"}`;
          const category = categoryMap.get(key) || { key, name: categoryNames.get(key) || "已删除分类", cents: 0, count: 0 };
          category.cents += cents;
          category.count += 1;
          categoryMap.set(key, category);
          totalCents += cents;
          count += 1;
        });
        const total = totalCents / 100;
        return {
          trend: trend.map((item) => ({ ...item, amount: item.cents / 100 })),
          categories: Array.from(categoryMap.values()).sort((a, b) => b.cents - a.cents).map((item, index) => ({ ...item, rank: index + 1, amount: item.cents / 100, percent: totalCents ? item.cents * 100 / totalCents : 0 })),
          total,
          count
        };
      }
      function resolveTrendKey(occurredOn, type, selectedRange, trend) {
        if (type === "YEAR")
          return occurredOn.slice(0, 7);
        if (type !== "CUSTOM")
          return occurredOn;
        const start = parseDate(selectedRange.startDate);
        const end = parseDate(selectedRange.endDate);
        const totalDays = Math.round((end - start) / 864e5) + 1;
        if (totalDays > 90)
          return occurredOn.slice(0, 7);
        if (totalDays > 31) {
          for (let i = trend.length - 1; i >= 0; i--) {
            if (occurredOn >= trend[i].key)
              return trend[i].key;
          }
          return trend[0].key;
        }
        return occurredOn;
      }
      function createTrendBuckets(selectedRange, type) {
        if (type === "YEAR") {
          const year = Number(selectedRange.startDate.slice(0, 4));
          return Array.from({ length: 12 }, (_, index) => ({ key: `${year}-${String(index + 1).padStart(2, "0")}`, label: `${index + 1}`, cents: 0 }));
        }
        const start = parseDate(selectedRange.startDate);
        const end = parseDate(selectedRange.endDate);
        const totalDays = Math.round((end - start) / 864e5) + 1;
        if (type === "CUSTOM" && totalDays > 90) {
          const buckets2 = [];
          const cursor2 = new Date(start.getFullYear(), start.getMonth(), 1);
          const endMonth = new Date(end.getFullYear(), end.getMonth(), 1);
          while (cursor2 <= endMonth) {
            const key = `${cursor2.getFullYear()}-${String(cursor2.getMonth() + 1).padStart(2, "0")}`;
            buckets2.push({ key, label: `${cursor2.getMonth() + 1}`, cents: 0 });
            cursor2.setMonth(cursor2.getMonth() + 1);
          }
          return buckets2;
        }
        if (type === "CUSTOM" && totalDays > 31) {
          const buckets2 = [];
          const cursor2 = new Date(start);
          while (cursor2 <= end) {
            const weekStart = new Date(cursor2);
            const weekEnd = new Date(cursor2);
            weekEnd.setDate(weekEnd.getDate() + 6);
            if (weekEnd > end)
              weekEnd.setTime(end.getTime());
            const key = formatDate(weekStart);
            buckets2.push({ key, label: `${weekStart.getMonth() + 1}/${weekStart.getDate()}`, cents: 0 });
            cursor2.setDate(cursor2.getDate() + 7);
          }
          return buckets2;
        }
        const buckets = [];
        const cursor = new Date(start);
        while (cursor <= end) {
          const key = formatDate(cursor);
          const label = type === "WEEK" ? `${cursor.getMonth() + 1}/${cursor.getDate()}` : `${cursor.getDate()}`;
          buckets.push({ key, label, cents: 0 });
          cursor.setDate(cursor.getDate() + 1);
        }
        return buckets;
      }
      function parseDate(value) {
        const [year, month, day] = value.split("-").map(Number);
        return new Date(year, month - 1, day);
      }
      function pieColor(index) {
        return pieColors[index % pieColors.length];
      }
      const __returned__ = { range, periodType, pickerVisible, pickerMode, pickerYear, pickerMonth, loading, trendData, categoryStats, expenseTotal, expenseTransactions, periodOptions, pickerModes, months, pieColors, screenWidth, trendPlotWidth, trendPlotHeight, trendPlotPadding, get requestId() {
        return requestId;
      }, set requestId(v) {
        requestId = v;
      }, years, weeks, pickerHeading, periodTitle, trendUnitLabel, peakAmount, averageExpense, trendPoints, trendSegments, trendLabelPoints, pieChartStyle, load, setPeriodType, openPicker, closePicker, previousPicker, nextPicker, commitRange, selectMonth, selectYear, selectWeek, isActiveMonth, isActiveYear, isActiveWeek, weekLabel, selectCustomStart, selectCustomEnd, aggregateExpenses, resolveTrendKey, createTrendBuckets, parseDate, pieColor, computed: vue.computed, reactive: vue.reactive, ref: vue.ref, get onLoad() {
        return onLoad;
      }, get appApi() {
        return appApi;
      }, get formatAmount() {
        return formatAmount;
      }, get formatDate() {
        return formatDate;
      }, get monthRange() {
        return monthRange;
      }, get weekRange() {
        return weekRange;
      }, get weekRangesInMonth() {
        return weekRangesInMonth;
      }, get yearRange() {
        return yearRange;
      }, get showRequestError() {
        return showRequestError;
      } };
      Object.defineProperty(__returned__, "__isScriptSetup", { enumerable: false, value: true });
      return __returned__;
    }
  };
  function _sfc_render$4(_ctx, _cache, $props, $setup, $data, $options) {
    return vue.openBlock(), vue.createElementBlock(
      vue.Fragment,
      null,
      [
        vue.createElementVNode("view", { class: "page" }, [
          vue.createElementVNode("view", { class: "filter-card" }, [
            vue.createElementVNode("view", { class: "period-tabs" }, [
              (vue.openBlock(), vue.createElementBlock(
                vue.Fragment,
                null,
                vue.renderList($setup.periodOptions, (item) => {
                  return vue.createElementVNode("text", {
                    key: item.value,
                    class: vue.normalizeClass(["period-tab", { active: $setup.periodType === item.value }]),
                    onClick: ($event) => $setup.setPeriodType(item.value)
                  }, vue.toDisplayString(item.label), 11, ["onClick"]);
                }),
                64
                /* STABLE_FRAGMENT */
              ))
            ]),
            $setup.periodType === "CUSTOM" ? (vue.openBlock(), vue.createElementBlock("view", {
              key: 0,
              class: "custom-range"
            }, [
              vue.createElementVNode("picker", {
                mode: "date",
                value: $setup.range.startDate,
                onChange: $setup.selectCustomStart
              }, [
                vue.createElementVNode("view", { class: "date-field" }, [
                  vue.createElementVNode("text", null, "开始日期"),
                  vue.createElementVNode(
                    "text",
                    null,
                    vue.toDisplayString($setup.range.startDate),
                    1
                    /* TEXT */
                  )
                ])
              ], 40, ["value"]),
              vue.createElementVNode("text", { class: "range-divider" }, "至"),
              vue.createElementVNode("picker", {
                mode: "date",
                value: $setup.range.endDate,
                onChange: $setup.selectCustomEnd
              }, [
                vue.createElementVNode("view", { class: "date-field" }, [
                  vue.createElementVNode("text", null, "结束日期"),
                  vue.createElementVNode(
                    "text",
                    null,
                    vue.toDisplayString($setup.range.endDate),
                    1
                    /* TEXT */
                  )
                ])
              ], 40, ["value"])
            ])) : (vue.openBlock(), vue.createElementBlock("view", {
              key: 1,
              class: "range-control",
              onClick: $setup.openPicker
            }, [
              vue.createElementVNode("view", null, [
                vue.createElementVNode(
                  "text",
                  { class: "range-title" },
                  vue.toDisplayString($setup.periodTitle),
                  1
                  /* TEXT */
                ),
                vue.createElementVNode(
                  "text",
                  { class: "range-detail" },
                  vue.toDisplayString($setup.range.startDate) + " 至 " + vue.toDisplayString($setup.range.endDate),
                  1
                  /* TEXT */
                )
              ]),
              vue.createElementVNode("text", { class: "range-arrow" }, "⌄")
            ]))
          ]),
          vue.createElementVNode("view", { class: "summary-card" }, [
            vue.createElementVNode("view", null, [
              vue.createElementVNode("text", { class: "summary-label" }, "区间总支出"),
              vue.createElementVNode(
                "text",
                { class: "summary-amount" },
                "¥ " + vue.toDisplayString($setup.formatAmount($setup.expenseTotal)),
                1
                /* TEXT */
              )
            ]),
            vue.createElementVNode("view", { class: "summary-side" }, [
              vue.createElementVNode(
                "text",
                null,
                vue.toDisplayString($setup.trendUnitLabel) + "均支出",
                1
                /* TEXT */
              ),
              vue.createElementVNode(
                "text",
                null,
                "¥ " + vue.toDisplayString($setup.formatAmount($setup.averageExpense)),
                1
                /* TEXT */
              )
            ])
          ]),
          vue.createElementVNode("view", { class: "card trend-card" }, [
            vue.createElementVNode("view", { class: "card-header" }, [
              vue.createElementVNode("view", null, [
                vue.createElementVNode("text", { class: "card-title" }, "支出趋势"),
                vue.createElementVNode(
                  "text",
                  { class: "card-subtitle" },
                  vue.toDisplayString($setup.trendUnitLabel) + "统计",
                  1
                  /* TEXT */
                )
              ]),
              vue.createElementVNode(
                "text",
                { class: "peak-label" },
                "最高 ¥ " + vue.toDisplayString($setup.formatAmount($setup.peakAmount)),
                1
                /* TEXT */
              )
            ]),
            $setup.trendData.length && $setup.expenseTotal > 0 ? (vue.openBlock(), vue.createElementBlock("view", {
              key: 0,
              class: "trend-chart"
            }, [
              vue.createElementVNode("view", { class: "trend-y-axis" }, [
                vue.createElementVNode(
                  "text",
                  null,
                  "¥ " + vue.toDisplayString($setup.formatAmount($setup.peakAmount)),
                  1
                  /* TEXT */
                ),
                vue.createElementVNode("text", null, "¥ 0.00")
              ]),
              vue.createElementVNode("view", { class: "trend-plot-wrap" }, [
                vue.createElementVNode("view", { class: "trend-plot" }, [
                  vue.createElementVNode("view", { class: "trend-grid-line grid-top" }),
                  vue.createElementVNode("view", { class: "trend-grid-line grid-middle" }),
                  vue.createElementVNode("view", { class: "trend-grid-line grid-bottom" }),
                  (vue.openBlock(true), vue.createElementBlock(
                    vue.Fragment,
                    null,
                    vue.renderList($setup.trendSegments, (segment) => {
                      return vue.openBlock(), vue.createElementBlock(
                        "view",
                        {
                          key: segment.key,
                          class: "trend-segment",
                          style: vue.normalizeStyle(segment.style)
                        },
                        null,
                        4
                        /* STYLE */
                      );
                    }),
                    128
                    /* KEYED_FRAGMENT */
                  )),
                  (vue.openBlock(true), vue.createElementBlock(
                    vue.Fragment,
                    null,
                    vue.renderList($setup.trendPoints, (point) => {
                      return vue.openBlock(), vue.createElementBlock(
                        "view",
                        {
                          key: point.key,
                          class: "trend-point",
                          style: vue.normalizeStyle(point.style)
                        },
                        null,
                        4
                        /* STYLE */
                      );
                    }),
                    128
                    /* KEYED_FRAGMENT */
                  ))
                ]),
                vue.createElementVNode("view", { class: "trend-x-axis" }, [
                  (vue.openBlock(true), vue.createElementBlock(
                    vue.Fragment,
                    null,
                    vue.renderList($setup.trendLabelPoints, (point) => {
                      return vue.openBlock(), vue.createElementBlock(
                        "text",
                        {
                          key: point.key,
                          style: vue.normalizeStyle(point.labelStyle)
                        },
                        vue.toDisplayString(point.label),
                        5
                        /* TEXT, STYLE */
                      );
                    }),
                    128
                    /* KEYED_FRAGMENT */
                  ))
                ])
              ])
            ])) : !$setup.loading ? (vue.openBlock(), vue.createElementBlock("view", {
              key: 1,
              class: "chart-empty"
            }, "该区间暂无支出记录")) : vue.createCommentVNode("v-if", true)
          ]),
          vue.createElementVNode("view", { class: "card category-card" }, [
            vue.createElementVNode("view", { class: "card-header" }, [
              vue.createElementVNode("view", null, [
                vue.createElementVNode("text", { class: "card-title" }, "支出占比"),
                vue.createElementVNode("text", { class: "card-subtitle" }, "按分类汇总")
              ]),
              vue.createElementVNode(
                "text",
                { class: "total-count" },
                vue.toDisplayString($setup.expenseTransactions) + " 笔",
                1
                /* TEXT */
              )
            ]),
            $setup.categoryStats.length ? (vue.openBlock(), vue.createElementBlock("view", {
              key: 0,
              class: "pie-section"
            }, [
              vue.createElementVNode(
                "view",
                {
                  class: vue.normalizeClass(["pie-chart", { "single-category": $setup.categoryStats.length === 1 }]),
                  style: vue.normalizeStyle($setup.pieChartStyle)
                },
                [
                  vue.createElementVNode("view", { class: "pie-hole" }, [
                    vue.createElementVNode("text", null, "总支出"),
                    vue.createElementVNode(
                      "text",
                      null,
                      "¥ " + vue.toDisplayString($setup.formatAmount($setup.expenseTotal)),
                      1
                      /* TEXT */
                    )
                  ])
                ],
                6
                /* CLASS, STYLE */
              ),
              vue.createElementVNode("view", { class: "pie-legend" }, [
                (vue.openBlock(true), vue.createElementBlock(
                  vue.Fragment,
                  null,
                  vue.renderList($setup.categoryStats.slice(0, 4), (item, index) => {
                    return vue.openBlock(), vue.createElementBlock("view", {
                      key: item.key,
                      class: "legend-item"
                    }, [
                      vue.createElementVNode(
                        "text",
                        {
                          class: "legend-dot",
                          style: vue.normalizeStyle({ background: $setup.pieColor(index) })
                        },
                        null,
                        4
                        /* STYLE */
                      ),
                      vue.createElementVNode("view", null, [
                        vue.createElementVNode(
                          "text",
                          null,
                          vue.toDisplayString(item.name),
                          1
                          /* TEXT */
                        ),
                        vue.createElementVNode(
                          "text",
                          null,
                          vue.toDisplayString(item.percent.toFixed(1)) + "%",
                          1
                          /* TEXT */
                        )
                      ])
                    ]);
                  }),
                  128
                  /* KEYED_FRAGMENT */
                ))
              ])
            ])) : vue.createCommentVNode("v-if", true),
            $setup.categoryStats.length ? (vue.openBlock(), vue.createElementBlock("view", {
              key: 1,
              class: "category-list"
            }, [
              (vue.openBlock(true), vue.createElementBlock(
                vue.Fragment,
                null,
                vue.renderList($setup.categoryStats, (item) => {
                  return vue.openBlock(), vue.createElementBlock("view", {
                    key: item.key,
                    class: "category-row"
                  }, [
                    vue.createElementVNode("view", { class: "category-row-top" }, [
                      vue.createElementVNode("view", { class: "category-name" }, [
                        vue.createElementVNode(
                          "text",
                          { class: "rank-badge" },
                          vue.toDisplayString(item.rank),
                          1
                          /* TEXT */
                        ),
                        vue.createElementVNode(
                          "text",
                          null,
                          vue.toDisplayString(item.name),
                          1
                          /* TEXT */
                        )
                      ]),
                      vue.createElementVNode(
                        "text",
                        null,
                        "¥ " + vue.toDisplayString($setup.formatAmount(item.amount)),
                        1
                        /* TEXT */
                      )
                    ]),
                    vue.createElementVNode("view", { class: "progress-track" }, [
                      vue.createElementVNode(
                        "view",
                        {
                          class: "progress-value",
                          style: vue.normalizeStyle({ width: `${item.percent}%` })
                        },
                        null,
                        4
                        /* STYLE */
                      )
                    ]),
                    vue.createElementVNode("view", { class: "category-row-bottom" }, [
                      vue.createElementVNode(
                        "text",
                        null,
                        vue.toDisplayString(item.count) + " 笔",
                        1
                        /* TEXT */
                      ),
                      vue.createElementVNode(
                        "text",
                        null,
                        vue.toDisplayString(item.percent.toFixed(1)) + "%",
                        1
                        /* TEXT */
                      )
                    ])
                  ]);
                }),
                128
                /* KEYED_FRAGMENT */
              ))
            ])) : !$setup.loading ? (vue.openBlock(), vue.createElementBlock("view", {
              key: 2,
              class: "empty"
            }, "该区间暂无支出分类")) : (vue.openBlock(), vue.createElementBlock("view", {
              key: 3,
              class: "empty"
            }, "加载中…"))
          ])
        ]),
        $setup.pickerVisible ? (vue.openBlock(), vue.createElementBlock("view", {
          key: 0,
          class: "picker-mask",
          onClick: vue.withModifiers($setup.closePicker, ["self"])
        }, [
          vue.createElementVNode("view", { class: "date-picker" }, [
            vue.createElementVNode("view", { class: "picker-handle" }),
            vue.createElementVNode("view", { class: "picker-tabs" }, [
              (vue.openBlock(), vue.createElementBlock(
                vue.Fragment,
                null,
                vue.renderList($setup.pickerModes, (item) => {
                  return vue.createElementVNode("text", {
                    key: item.value,
                    class: vue.normalizeClass(["picker-tab", { active: $setup.pickerMode === item.value }]),
                    onClick: ($event) => $setup.pickerMode = item.value
                  }, vue.toDisplayString(item.label), 11, ["onClick"]);
                }),
                64
                /* STABLE_FRAGMENT */
              ))
            ]),
            vue.createElementVNode("view", { class: "picker-nav" }, [
              vue.createElementVNode("text", {
                class: "nav-button",
                onClick: $setup.previousPicker
              }, "‹"),
              vue.createElementVNode(
                "text",
                { class: "picker-heading" },
                vue.toDisplayString($setup.pickerHeading),
                1
                /* TEXT */
              ),
              vue.createElementVNode("text", {
                class: "nav-button",
                onClick: $setup.nextPicker
              }, "›")
            ]),
            $setup.pickerMode === "MONTH" ? (vue.openBlock(), vue.createElementBlock("view", {
              key: 0,
              class: "date-grid"
            }, [
              (vue.openBlock(true), vue.createElementBlock(
                vue.Fragment,
                null,
                vue.renderList($setup.months, (month) => {
                  return vue.openBlock(), vue.createElementBlock("text", {
                    key: month.value,
                    class: vue.normalizeClass(["date-cell", { active: $setup.isActiveMonth(month.value) }]),
                    onClick: ($event) => $setup.selectMonth(month.value)
                  }, vue.toDisplayString(month.label), 11, ["onClick"]);
                }),
                128
                /* KEYED_FRAGMENT */
              ))
            ])) : $setup.pickerMode === "YEAR" ? (vue.openBlock(), vue.createElementBlock("view", {
              key: 1,
              class: "date-grid"
            }, [
              (vue.openBlock(true), vue.createElementBlock(
                vue.Fragment,
                null,
                vue.renderList($setup.years, (year) => {
                  return vue.openBlock(), vue.createElementBlock("text", {
                    key: year,
                    class: vue.normalizeClass(["date-cell", { active: $setup.isActiveYear(year) }]),
                    onClick: ($event) => $setup.selectYear(year)
                  }, vue.toDisplayString(year), 11, ["onClick"]);
                }),
                128
                /* KEYED_FRAGMENT */
              ))
            ])) : (vue.openBlock(), vue.createElementBlock("view", {
              key: 2,
              class: "week-list"
            }, [
              (vue.openBlock(true), vue.createElementBlock(
                vue.Fragment,
                null,
                vue.renderList($setup.weeks, (week) => {
                  return vue.openBlock(), vue.createElementBlock("view", {
                    key: week.startDate,
                    class: vue.normalizeClass(["week-cell", { active: $setup.isActiveWeek(week) }]),
                    onClick: ($event) => $setup.selectWeek(week)
                  }, [
                    vue.createElementVNode(
                      "text",
                      null,
                      vue.toDisplayString($setup.weekLabel(week)),
                      1
                      /* TEXT */
                    ),
                    vue.createElementVNode(
                      "text",
                      null,
                      vue.toDisplayString(week.startDate) + " 至 " + vue.toDisplayString(week.endDate),
                      1
                      /* TEXT */
                    )
                  ], 10, ["onClick"]);
                }),
                128
                /* KEYED_FRAGMENT */
              ))
            ]))
          ])
        ])) : vue.createCommentVNode("v-if", true)
      ],
      64
      /* STABLE_FRAGMENT */
    );
  }
  const PagesLedgerExpenseStatistics = /* @__PURE__ */ _export_sfc(_sfc_main$5, [["render", _sfc_render$4], ["__scopeId", "data-v-382d220b"], ["__file", "D:/code/mechiBookkeeping/frontend/src/pages/ledger/expense-statistics.vue"]]);
  const _sfc_main$4 = {
    __name: "transaction-form",
    setup(__props, { expose: __expose }) {
      __expose();
      const categories = vue.ref([]);
      const submitting = vue.ref(false);
      const calendarVisible = vue.ref(false);
      const calendarYear = vue.ref((/* @__PURE__ */ new Date()).getFullYear());
      const calendarMonth = vue.ref((/* @__PURE__ */ new Date()).getMonth());
      const amountExpression = vue.ref("");
      const weekdays = ["一", "二", "三", "四", "五", "六", "日"];
      const form = vue.reactive({ categoryId: null, categorySource: null, transactionType: "EXPENSE", amount: "", occurredOn: formatDate(/* @__PURE__ */ new Date()), note: "" });
      const keypadKeys = [
        { label: "7", action: "7" },
        { label: "8", action: "8" },
        { label: "9", action: "9" },
        { label: "🗓 今天", action: "date", className: "date-key" },
        { label: "4", action: "4" },
        { label: "5", action: "5" },
        { label: "6", action: "6" },
        { label: "+", action: "add", className: "utility-key" },
        { label: "1", action: "1" },
        { label: "2", action: "2" },
        { label: "3", action: "3" },
        { label: "−", action: "subtract", className: "utility-key" },
        { label: ".", action: "." },
        { label: "0", action: "0" },
        { label: "⌫", action: "delete", className: "utility-key" },
        { label: "完成", action: "submit", className: "submit-key" }
      ];
      const filteredCategories = vue.computed(() => categories.value.filter((item) => item.transactionType === form.transactionType && (item.source !== "SYSTEM" || item.status === "ACTIVE")).map((item) => ({ ...item, label: `${item.name}${item.source === "SYSTEM" ? "（系统）" : "（自定义）"}` })));
      const displayAmount = vue.computed(() => amountExpression.value || "0.00");
      const calendarCells = vue.computed(() => {
        const firstWeekday = (new Date(calendarYear.value, calendarMonth.value, 1).getDay() + 6) % 7;
        const daysInMonth = new Date(calendarYear.value, calendarMonth.value + 1, 0).getDate();
        return [...Array.from({ length: firstWeekday }, () => ({})), ...Array.from({ length: daysInMonth }, (_, index) => ({ day: index + 1 }))];
      });
      onLoad(load);
      function goBack() {
        uni.navigateBack({ delta: 1, fail: () => uni.switchTab({ url: "/pages/ledger/index" }) });
      }
      async function load() {
        try {
          categories.value = await appApi.listCategories();
        } catch (error) {
          showRequestError(error);
        }
      }
      function selectType(type) {
        form.transactionType = type;
        form.categoryId = null;
        form.categorySource = null;
      }
      function selectCategory(item) {
        form.categoryId = item.id;
        form.categorySource = item.source;
      }
      function isSelectedCategory(item) {
        return item.id === form.categoryId && item.source === form.categorySource;
      }
      function categoryIcon(name) {
        const icons = { 餐饮: "🍱", 购物: "🛍️", 日用: "🧻", 交通: "🚌", 蔬菜: "🥬", 水果: "🍎", 零食: "🧁", 运动: "🛼", 娱乐: "🎮", 通讯: "📞", 服饰: "👕", 美容: "🪞", 工资: "💰", 奖金: "🎁", 理财: "📈", 退款: "↩️" };
        return icons[name] || (form.transactionType === "EXPENSE" ? "◌" : "＋");
      }
      function evaluateExpression(expression) {
        if (!/^\d+(?:\.\d{1,2})?(?:[+-]\d+(?:\.\d{1,2})?)*$/.test(expression))
          return null;
        const terms = expression.match(/[+-]?\d+(?:\.\d{1,2})?/g);
        if (!terms)
          return null;
        const amount = terms.reduce((total, term) => total + Number(term), 0);
        return Number.isFinite(amount) ? Math.round((amount + Number.EPSILON) * 100) / 100 : null;
      }
      function appendNumber(value) {
        const currentPart = amountExpression.value.split(/[+-]/).pop();
        if (value === "." && currentPart.includes("."))
          return;
        if (currentPart.includes(".") && currentPart.split(".")[1].length >= 2)
          return;
        amountExpression.value = value === "." && !currentPart ? `${amountExpression.value}0.` : `${amountExpression.value}${value}`;
      }
      function appendOperator(operator) {
        if (!amountExpression.value)
          return;
        if (/[+-]$/.test(amountExpression.value)) {
          amountExpression.value = `${amountExpression.value.slice(0, -1)}${operator}`;
          return;
        }
        const calculatedAmount = evaluateExpression(amountExpression.value);
        const baseAmount = calculatedAmount === null ? amountExpression.value : Number.isInteger(calculatedAmount) ? String(calculatedAmount) : calculatedAmount.toFixed(2);
        amountExpression.value = `${baseAmount}${operator}`;
      }
      function handleKey(action) {
        if (action === "date")
          return openCalendar();
        if (action === "delete") {
          amountExpression.value = amountExpression.value.slice(0, -1);
          return;
        }
        if (action === "add")
          return appendOperator("+");
        if (action === "subtract")
          return appendOperator("-");
        if (action === "submit")
          return submit();
        appendNumber(action);
      }
      function dateParts(value) {
        return { year: Number(value.slice(0, 4)), month: Number(value.slice(5, 7)) - 1, day: Number(value.slice(8, 10)) };
      }
      function openCalendar() {
        const date = dateParts(form.occurredOn);
        calendarYear.value = date.year;
        calendarMonth.value = date.month;
        calendarVisible.value = true;
      }
      function closeCalendar() {
        calendarVisible.value = false;
      }
      function previousMonth() {
        const date = new Date(calendarYear.value, calendarMonth.value - 1, 1);
        calendarYear.value = date.getFullYear();
        calendarMonth.value = date.getMonth();
      }
      function nextMonth() {
        const date = new Date(calendarYear.value, calendarMonth.value + 1, 1);
        calendarYear.value = date.getFullYear();
        calendarMonth.value = date.getMonth();
      }
      function selectDate(day) {
        form.occurredOn = formatDate(new Date(calendarYear.value, calendarMonth.value, day));
        calendarVisible.value = false;
      }
      function isSelectedDate(day) {
        return Boolean(day) && form.occurredOn === formatDate(new Date(calendarYear.value, calendarMonth.value, day));
      }
      function isToday(day) {
        return Boolean(day) && formatDate(/* @__PURE__ */ new Date()) === formatDate(new Date(calendarYear.value, calendarMonth.value, day));
      }
      async function submit() {
        if (!form.categoryId || !form.categorySource)
          return uni.showToast({ title: "请选择分类", icon: "none" });
        if (!form.occurredOn)
          return uni.showToast({ title: "请选择日期", icon: "none" });
        const calculatedAmount = evaluateExpression(amountExpression.value);
        if (calculatedAmount === null || calculatedAmount <= 0)
          return uni.showToast({ title: "请输入正确金额", icon: "none" });
        form.amount = calculatedAmount.toFixed(2);
        submitting.value = true;
        try {
          await appApi.createTransaction({ ...form, amount: form.amount, note: form.note || null });
          uni.showToast({ title: "已保存", icon: "success" });
          setTimeout(() => uni.navigateBack(), 450);
        } catch (error) {
          showRequestError(error);
        } finally {
          submitting.value = false;
        }
      }
      const __returned__ = { categories, submitting, calendarVisible, calendarYear, calendarMonth, amountExpression, weekdays, form, keypadKeys, filteredCategories, displayAmount, calendarCells, goBack, load, selectType, selectCategory, isSelectedCategory, categoryIcon, evaluateExpression, appendNumber, appendOperator, handleKey, dateParts, openCalendar, closeCalendar, previousMonth, nextMonth, selectDate, isSelectedDate, isToday, submit, computed: vue.computed, reactive: vue.reactive, ref: vue.ref, get onLoad() {
        return onLoad;
      }, get appApi() {
        return appApi;
      }, get formatDate() {
        return formatDate;
      }, get showRequestError() {
        return showRequestError;
      } };
      Object.defineProperty(__returned__, "__isScriptSetup", { enumerable: false, value: true });
      return __returned__;
    }
  };
  function _sfc_render$3(_ctx, _cache, $props, $setup, $data, $options) {
    return vue.openBlock(), vue.createElementBlock("view", { class: "page" }, [
      vue.createElementVNode("view", { class: "book-header" }, [
        vue.createElementVNode("view", {
          class: "back-button",
          onClick: $setup.goBack
        }, "‹"),
        vue.createElementVNode("view", { class: "book-title" }, [
          vue.createElementVNode("text", null, "默认账本"),
          vue.createElementVNode("text", { class: "book-subtitle" }, "记录每一笔收支")
        ]),
        vue.createElementVNode("view", { class: "book-icon" }, "📋")
      ]),
      vue.createElementVNode("view", { class: "type-switch" }, [
        vue.createElementVNode(
          "view",
          {
            class: vue.normalizeClass(["type", { "active-expense": $setup.form.transactionType === "EXPENSE" }]),
            onClick: _cache[0] || (_cache[0] = ($event) => $setup.selectType("EXPENSE"))
          },
          [
            vue.createElementVNode("text", null, "支出")
          ],
          2
          /* CLASS */
        ),
        vue.createElementVNode(
          "view",
          {
            class: vue.normalizeClass(["type", { "active-income": $setup.form.transactionType === "INCOME" }]),
            onClick: _cache[1] || (_cache[1] = ($event) => $setup.selectType("INCOME"))
          },
          [
            vue.createElementVNode("text", null, "收入")
          ],
          2
          /* CLASS */
        )
      ]),
      vue.createElementVNode("view", { class: "category-section" }, [
        $setup.filteredCategories.length ? (vue.openBlock(), vue.createElementBlock("view", {
          key: 0,
          class: "category-grid"
        }, [
          (vue.openBlock(true), vue.createElementBlock(
            vue.Fragment,
            null,
            vue.renderList($setup.filteredCategories, (item) => {
              return vue.openBlock(), vue.createElementBlock("view", {
                key: `${item.source}-${item.id}`,
                class: vue.normalizeClass(["category-item", { selected: $setup.isSelectedCategory(item) }]),
                onClick: ($event) => $setup.selectCategory(item)
              }, [
                vue.createElementVNode("view", { class: "category-icon" }, [
                  vue.createElementVNode(
                    "text",
                    null,
                    vue.toDisplayString($setup.categoryIcon(item.name)),
                    1
                    /* TEXT */
                  )
                ]),
                vue.createElementVNode(
                  "text",
                  { class: "category-name" },
                  vue.toDisplayString(item.name),
                  1
                  /* TEXT */
                )
              ], 10, ["onClick"]);
            }),
            128
            /* KEYED_FRAGMENT */
          ))
        ])) : (vue.openBlock(), vue.createElementBlock(
          "view",
          {
            key: 1,
            class: "empty-category"
          },
          "暂无可用" + vue.toDisplayString($setup.form.transactionType === "EXPENSE" ? "支出" : "收入") + "分类",
          1
          /* TEXT */
        )),
        vue.createElementVNode("view", { class: "category-dots" }, [
          vue.createElementVNode("text", { class: "active-dot" }),
          vue.createElementVNode("text"),
          vue.createElementVNode("text"),
          vue.createElementVNode("text")
        ])
      ]),
      vue.createElementVNode("view", { class: "entry-panel" }, [
        vue.createElementVNode("view", { class: "entry-row" }, [
          vue.createElementVNode("view", { class: "note-icon" }, "👛"),
          vue.withDirectives(vue.createElementVNode(
            "input",
            {
              "onUpdate:modelValue": _cache[2] || (_cache[2] = ($event) => $setup.form.note = $event),
              class: "note-input",
              placeholder: "点击输入备注...",
              maxlength: "255"
            },
            null,
            512
            /* NEED_PATCH */
          ), [
            [
              vue.vModelText,
              $setup.form.note,
              void 0,
              { trim: true }
            ]
          ]),
          vue.createElementVNode("view", { class: "amount-display" }, [
            vue.createElementVNode("text", { class: "currency" }, "¥"),
            vue.createElementVNode(
              "text",
              null,
              vue.toDisplayString($setup.displayAmount),
              1
              /* TEXT */
            )
          ])
        ]),
        vue.createElementVNode("view", { class: "keypad" }, [
          (vue.openBlock(), vue.createElementBlock(
            vue.Fragment,
            null,
            vue.renderList($setup.keypadKeys, (key) => {
              return vue.createElementVNode("view", {
                key: key.label,
                class: vue.normalizeClass(["key", key.className, { loading: key.action === "submit" && $setup.submitting }]),
                onClick: ($event) => $setup.handleKey(key.action)
              }, vue.toDisplayString(key.action === "submit" && $setup.submitting ? "保存中" : key.label), 11, ["onClick"]);
            }),
            64
            /* STABLE_FRAGMENT */
          ))
        ])
      ]),
      $setup.calendarVisible ? (vue.openBlock(), vue.createElementBlock("view", {
        key: 0,
        class: "calendar-mask",
        onClick: vue.withModifiers($setup.closeCalendar, ["self"])
      }, [
        vue.createElementVNode("view", { class: "calendar-panel" }, [
          vue.createElementVNode("view", { class: "calendar-handle" }),
          vue.createElementVNode("view", { class: "calendar-topbar" }, [
            vue.createElementVNode("text", { class: "calendar-title" }, "选择日期"),
            vue.createElementVNode(
              "text",
              { class: "calendar-current" },
              vue.toDisplayString($setup.form.occurredOn),
              1
              /* TEXT */
            )
          ]),
          vue.createElementVNode("view", { class: "calendar-nav" }, [
            vue.createElementVNode("text", {
              class: "nav-button",
              onClick: $setup.previousMonth
            }, "‹"),
            vue.createElementVNode(
              "text",
              { class: "calendar-heading" },
              vue.toDisplayString($setup.calendarYear) + "年" + vue.toDisplayString($setup.calendarMonth + 1) + "月",
              1
              /* TEXT */
            ),
            vue.createElementVNode("text", {
              class: "nav-button",
              onClick: $setup.nextMonth
            }, "›")
          ]),
          vue.createElementVNode("view", { class: "weekdays" }, [
            (vue.openBlock(), vue.createElementBlock(
              vue.Fragment,
              null,
              vue.renderList($setup.weekdays, (weekday) => {
                return vue.createElementVNode(
                  "text",
                  { key: weekday },
                  vue.toDisplayString(weekday),
                  1
                  /* TEXT */
                );
              }),
              64
              /* STABLE_FRAGMENT */
            ))
          ]),
          vue.createElementVNode("view", { class: "calendar-grid" }, [
            (vue.openBlock(true), vue.createElementBlock(
              vue.Fragment,
              null,
              vue.renderList($setup.calendarCells, (cell, index) => {
                return vue.openBlock(), vue.createElementBlock("view", {
                  key: `${cell.day || "blank"}-${index}`,
                  class: vue.normalizeClass(["calendar-day", { "calendar-empty": !cell.day, selected: $setup.isSelectedDate(cell.day), today: $setup.isToday(cell.day) }]),
                  onClick: ($event) => cell.day && $setup.selectDate(cell.day)
                }, vue.toDisplayString(cell.day || ""), 11, ["onClick"]);
              }),
              128
              /* KEYED_FRAGMENT */
            ))
          ])
        ])
      ])) : vue.createCommentVNode("v-if", true)
    ]);
  }
  const PagesLedgerTransactionForm = /* @__PURE__ */ _export_sfc(_sfc_main$4, [["render", _sfc_render$3], ["__scopeId", "data-v-ef724408"], ["__file", "D:/code/mechiBookkeeping/frontend/src/pages/ledger/transaction-form.vue"]]);
  const _sfc_main$3 = {
    __name: "categories",
    setup(__props, { expose: __expose }) {
      __expose();
      const categories = vue.ref([]);
      const editingId = vue.ref(null);
      const form = vue.reactive({ name: "", transactionType: "EXPENSE" });
      onShow(load);
      async function load() {
        try {
          categories.value = await appApi.listCategories();
        } catch (error) {
          showRequestError(error);
        }
      }
      function systemByType(type) {
        return categories.value.filter((item) => item.source === "SYSTEM" && item.transactionType === type);
      }
      function customByType(type) {
        return categories.value.filter((item) => item.source === "CUSTOM" && item.transactionType === type);
      }
      async function save() {
        if (!form.name)
          return uni.showToast({ title: "请输入分类名称", icon: "none" });
        try {
          if (editingId.value)
            await appApi.updateCategory(editingId.value, form);
          else
            await appApi.createCategory(form);
          reset();
          await load();
          uni.showToast({ title: "已保存", icon: "success" });
        } catch (error) {
          showRequestError(error);
        }
      }
      function edit(item) {
        editingId.value = item.id;
        form.name = item.name;
        form.transactionType = item.transactionType;
      }
      function reset() {
        editingId.value = null;
        form.name = "";
        form.transactionType = "EXPENSE";
      }
      function remove2(item) {
        uni.showModal({ title: "删除自定义分类", content: `确定删除“${item.name}”吗？`, success: async ({ confirm }) => {
          if (!confirm)
            return;
          try {
            await appApi.deleteCategory(item.id);
            await load();
            uni.showToast({ title: "已删除", icon: "success" });
          } catch (error) {
            showRequestError(error);
          }
        } });
      }
      const __returned__ = { categories, editingId, form, load, systemByType, customByType, save, edit, reset, remove: remove2, reactive: vue.reactive, ref: vue.ref, get onShow() {
        return onShow;
      }, get appApi() {
        return appApi;
      }, get showRequestError() {
        return showRequestError;
      } };
      Object.defineProperty(__returned__, "__isScriptSetup", { enumerable: false, value: true });
      return __returned__;
    }
  };
  function _sfc_render$2(_ctx, _cache, $props, $setup, $data, $options) {
    return vue.openBlock(), vue.createElementBlock("view", { class: "page" }, [
      vue.createElementVNode("view", { class: "card form" }, [
        vue.createElementVNode("text", { class: "form-title" }, "我的自定义分类"),
        vue.withDirectives(vue.createElementVNode(
          "input",
          {
            "onUpdate:modelValue": _cache[0] || (_cache[0] = ($event) => $setup.form.name = $event),
            class: "input",
            placeholder: "分类名称，如：宠物",
            maxlength: "32"
          },
          null,
          512
          /* NEED_PATCH */
        ), [
          [
            vue.vModelText,
            $setup.form.name,
            void 0,
            { trim: true }
          ]
        ]),
        vue.createElementVNode("view", { class: "type-row" }, [
          vue.createElementVNode(
            "view",
            {
              class: vue.normalizeClass(["pill", $setup.form.transactionType === "EXPENSE" && "selected-expense"]),
              onClick: _cache[1] || (_cache[1] = ($event) => $setup.form.transactionType = "EXPENSE")
            },
            "支出",
            2
            /* CLASS */
          ),
          vue.createElementVNode(
            "view",
            {
              class: vue.normalizeClass(["pill", $setup.form.transactionType === "INCOME" && "selected-income"]),
              onClick: _cache[2] || (_cache[2] = ($event) => $setup.form.transactionType = "INCOME")
            },
            "收入",
            2
            /* CLASS */
          ),
          vue.createElementVNode(
            "button",
            {
              class: "small-add",
              onClick: $setup.save
            },
            vue.toDisplayString($setup.editingId ? "更新" : "添加"),
            1
            /* TEXT */
          )
        ])
      ]),
      (vue.openBlock(), vue.createElementBlock(
        vue.Fragment,
        null,
        vue.renderList(["EXPENSE", "INCOME"], (type) => {
          return vue.createElementVNode("view", {
            key: type,
            class: "section"
          }, [
            vue.createElementVNode(
              "text",
              { class: "section-title" },
              vue.toDisplayString(type === "EXPENSE" ? "系统支出分类（后台维护）" : "系统收入分类（后台维护）"),
              1
              /* TEXT */
            ),
            vue.createElementVNode("view", { class: "category-card" }, [
              (vue.openBlock(true), vue.createElementBlock(
                vue.Fragment,
                null,
                vue.renderList($setup.systemByType(type), (item) => {
                  return vue.openBlock(), vue.createElementBlock("view", {
                    key: `system-${item.id}`,
                    class: "category-item"
                  }, [
                    vue.createElementVNode(
                      "text",
                      null,
                      vue.toDisplayString(item.name),
                      1
                      /* TEXT */
                    ),
                    vue.createElementVNode(
                      "text",
                      {
                        class: vue.normalizeClass(item.status === "ACTIVE" ? "readonly" : "disabled")
                      },
                      vue.toDisplayString(item.status === "ACTIVE" ? "系统分类" : "已停用"),
                      3
                      /* TEXT, CLASS */
                    )
                  ]);
                }),
                128
                /* KEYED_FRAGMENT */
              )),
              !$setup.systemByType(type).length ? (vue.openBlock(), vue.createElementBlock("view", {
                key: 0,
                class: "empty small-empty"
              }, "暂无系统分类")) : vue.createCommentVNode("v-if", true)
            ])
          ]);
        }),
        64
        /* STABLE_FRAGMENT */
      )),
      (vue.openBlock(), vue.createElementBlock(
        vue.Fragment,
        null,
        vue.renderList(["EXPENSE", "INCOME"], (type) => {
          return vue.createElementVNode("view", {
            key: `custom-${type}`,
            class: "section"
          }, [
            vue.createElementVNode(
              "text",
              { class: "section-title" },
              vue.toDisplayString(type === "EXPENSE" ? "我的支出分类" : "我的收入分类"),
              1
              /* TEXT */
            ),
            vue.createElementVNode("view", { class: "category-card" }, [
              (vue.openBlock(true), vue.createElementBlock(
                vue.Fragment,
                null,
                vue.renderList($setup.customByType(type), (item) => {
                  return vue.openBlock(), vue.createElementBlock("view", {
                    key: `custom-${item.id}`,
                    class: "category-item"
                  }, [
                    vue.createElementVNode(
                      "text",
                      null,
                      vue.toDisplayString(item.name),
                      1
                      /* TEXT */
                    ),
                    vue.createElementVNode("view", null, [
                      vue.createElementVNode("text", {
                        class: "edit",
                        onClick: ($event) => $setup.edit(item)
                      }, "编辑", 8, ["onClick"]),
                      vue.createElementVNode("text", {
                        class: "delete",
                        onClick: ($event) => $setup.remove(item)
                      }, "删除", 8, ["onClick"])
                    ])
                  ]);
                }),
                128
                /* KEYED_FRAGMENT */
              )),
              !$setup.customByType(type).length ? (vue.openBlock(), vue.createElementBlock("view", {
                key: 0,
                class: "empty small-empty"
              }, "暂无自定义分类")) : vue.createCommentVNode("v-if", true)
            ])
          ]);
        }),
        64
        /* STABLE_FRAGMENT */
      ))
    ]);
  }
  const PagesLedgerCategories = /* @__PURE__ */ _export_sfc(_sfc_main$3, [["render", _sfc_render$2], ["__scopeId", "data-v-eb3d6ed0"], ["__file", "D:/code/mechiBookkeeping/frontend/src/pages/ledger/categories.vue"]]);
  const SESSION_KEY = "mechi_chat_session_id";
  const _sfc_main$2 = {
    __name: "index",
    setup(__props, { expose: __expose }) {
      __expose();
      const messages = vue.ref([]);
      const input = vue.ref("");
      const sending = vue.ref(false);
      const bottomId = vue.ref("chat-bottom");
      const sessionId = vue.ref("");
      const userAvatarFailed = vue.ref(false);
      const userAvatar = vue.computed(() => {
        var _a;
        return ((_a = authStore.profile) == null ? void 0 : _a.avatar) || "";
      });
      const userInitial = vue.computed(() => {
        var _a;
        return (((_a = authStore.profile) == null ? void 0 : _a.username) || "我").slice(0, 1).toUpperCase();
      });
      onShow(loadHistory);
      function isUserMessage(item) {
        return item.role === "USER" || item.role === "user";
      }
      function ensureSession2() {
        sessionId.value = uni.getStorageSync(SESSION_KEY) || `chat_${Date.now()}`;
        uni.setStorageSync(SESSION_KEY, sessionId.value);
      }
      async function loadHistory() {
        ensureSession2();
        try {
          messages.value = await appApi.chatHistory(sessionId.value);
          scrollBottom();
        } catch (error) {
          showRequestError(error);
        }
      }
      async function send() {
        const message = input.value.trim();
        if (!message || sending.value)
          return;
        input.value = "";
        messages.value.push({ role: "USER", content: message });
        const assistantMessage = { role: "ASSISTANT", content: "", streaming: true };
        messages.value.push(assistantMessage);
        scrollBottom();
        sending.value = true;
        try {
          await appApi.streamChat({ message, sessionId: sessionId.value }, (token) => {
            if (token.startsWith("[ERROR]"))
              throw new Error(token.replace(/^\[ERROR\]\s*/, ""));
            assistantMessage.content += token;
            scrollBottom();
          });
        } catch (error) {
          if (!assistantMessage.content)
            messages.value.pop();
          showRequestError(error);
        } finally {
          assistantMessage.streaming = false;
          sending.value = false;
          scrollBottom();
        }
      }
      function scrollBottom() {
        vue.nextTick(() => {
          bottomId.value = "";
          setTimeout(() => {
            bottomId.value = "chat-bottom";
          }, 20);
        });
      }
      const __returned__ = { SESSION_KEY, messages, input, sending, bottomId, sessionId, userAvatarFailed, userAvatar, userInitial, isUserMessage, ensureSession: ensureSession2, loadHistory, send, scrollBottom, computed: vue.computed, nextTick: vue.nextTick, ref: vue.ref, get onShow() {
        return onShow;
      }, get appApi() {
        return appApi;
      }, get authStore() {
        return authStore;
      }, get showRequestError() {
        return showRequestError;
      } };
      Object.defineProperty(__returned__, "__isScriptSetup", { enumerable: false, value: true });
      return __returned__;
    }
  };
  function _sfc_render$1(_ctx, _cache, $props, $setup, $data, $options) {
    return vue.openBlock(), vue.createElementBlock("view", { class: "chat-page" }, [
      vue.createElementVNode("scroll-view", {
        class: "messages",
        "scroll-y": "",
        "scroll-into-view": $setup.bottomId
      }, [
        !$setup.messages.length ? (vue.openBlock(), vue.createElementBlock("view", {
          key: 0,
          class: "welcome"
        }, [
          vue.createElementVNode("view", { class: "welcome-avatar" }, "AI"),
          vue.createElementVNode("text", { class: "welcome-title" }, "你好，我是记账助手"),
          vue.createElementVNode("text", { class: "welcome-description" }, "可以问我记账建议，或聊聊你的收支规划。")
        ])) : vue.createCommentVNode("v-if", true),
        (vue.openBlock(true), vue.createElementBlock(
          vue.Fragment,
          null,
          vue.renderList($setup.messages, (item, index) => {
            return vue.openBlock(), vue.createElementBlock("view", {
              id: `message-${index}`,
              key: `${item.id || index}-${item.createdAt || ""}`,
              class: vue.normalizeClass(["message-row", $setup.isUserMessage(item) ? "user-row" : "assistant-row"])
            }, [
              !$setup.isUserMessage(item) ? (vue.openBlock(), vue.createElementBlock("view", {
                key: 0,
                class: "message-avatar assistant-avatar"
              }, "AI")) : vue.createCommentVNode("v-if", true),
              vue.createElementVNode("view", { class: "message-content" }, [
                vue.createElementVNode(
                  "view",
                  {
                    class: vue.normalizeClass(["message", $setup.isUserMessage(item) ? "user" : "assistant"])
                  },
                  [
                    vue.createElementVNode(
                      "text",
                      null,
                      vue.toDisplayString(item.content),
                      1
                      /* TEXT */
                    ),
                    item.streaming ? (vue.openBlock(), vue.createElementBlock("text", {
                      key: 0,
                      class: "typing-cursor"
                    }, "▍")) : vue.createCommentVNode("v-if", true)
                  ],
                  2
                  /* CLASS */
                )
              ]),
              $setup.isUserMessage(item) && $setup.userAvatar && !$setup.userAvatarFailed ? (vue.openBlock(), vue.createElementBlock("image", {
                key: 1,
                class: "message-avatar user-avatar-image",
                src: $setup.userAvatar,
                mode: "aspectFill",
                onError: _cache[0] || (_cache[0] = ($event) => $setup.userAvatarFailed = true)
              }, null, 40, ["src"])) : $setup.isUserMessage(item) ? (vue.openBlock(), vue.createElementBlock(
                "view",
                {
                  key: 2,
                  class: "message-avatar user-avatar"
                },
                vue.toDisplayString($setup.userInitial),
                1
                /* TEXT */
              )) : vue.createCommentVNode("v-if", true)
            ], 10, ["id"]);
          }),
          128
          /* KEYED_FRAGMENT */
        )),
        vue.createElementVNode("view", { id: "chat-bottom" })
      ], 8, ["scroll-into-view"]),
      vue.createElementVNode("view", { class: "composer" }, [
        vue.createElementVNode("view", { class: "composer-field" }, [
          vue.withDirectives(vue.createElementVNode(
            "input",
            {
              "onUpdate:modelValue": _cache[1] || (_cache[1] = ($event) => $setup.input = $event),
              class: "composer-input",
              maxlength: "1000",
              "confirm-type": "send",
              placeholder: "输入消息，向助手提问…",
              onConfirm: $setup.send
            },
            null,
            544
            /* NEED_HYDRATION, NEED_PATCH */
          ), [
            [vue.vModelText, $setup.input]
          ]),
          $setup.input.length ? (vue.openBlock(), vue.createElementBlock(
            "text",
            {
              key: 0,
              class: "composer-count"
            },
            vue.toDisplayString($setup.input.length) + "/1000",
            1
            /* TEXT */
          )) : vue.createCommentVNode("v-if", true)
        ]),
        vue.createElementVNode("button", {
          class: vue.normalizeClass(["send", { "send-ready": $setup.input.trim() && !$setup.sending }]),
          disabled: !$setup.input.trim() || $setup.sending,
          loading: $setup.sending,
          onClick: $setup.send
        }, "发送", 10, ["disabled", "loading"])
      ])
    ]);
  }
  const PagesChatIndex = /* @__PURE__ */ _export_sfc(_sfc_main$2, [["render", _sfc_render$1], ["__scopeId", "data-v-da04a0a0"], ["__file", "D:/code/mechiBookkeeping/frontend/src/pages/chat/index.vue"]]);
  const _sfc_main$1 = {
    __name: "index",
    setup(__props, { expose: __expose }) {
      __expose();
      const avatar = vue.ref("");
      const savedAvatar = vue.ref("");
      const uploading = vue.ref(false);
      const saving = vue.ref(false);
      const previewFailed = vue.ref(false);
      const avatarDialogVisible = vue.ref(false);
      const cropping = vue.ref(false);
      const cropSource = vue.ref("");
      const cropSize = vue.ref(280);
      const sourceWidth = vue.ref(0);
      const sourceHeight = vue.ref(0);
      const baseScale = vue.ref(1);
      const zoom = vue.ref(1);
      const offsetX = vue.ref(0);
      const offsetY = vue.ref(0);
      const dragStart = vue.ref(null);
      const activityStats = vue.ref({ totalBookkeepingDays: null, totalTransactionCount: null, currentStreakDays: null });
      const initial = vue.computed(() => {
        var _a;
        return (((_a = authStore.profile) == null ? void 0 : _a.username) || "用").slice(0, 1).toUpperCase();
      });
      const hasChanges = vue.computed(() => avatar.value !== savedAvatar.value);
      const imageWidth = vue.computed(() => sourceWidth.value * baseScale.value * zoom.value);
      const imageHeight = vue.computed(() => sourceHeight.value * baseScale.value * zoom.value);
      const imageLeft = vue.computed(() => (cropSize.value - imageWidth.value) / 2 + offsetX.value);
      const imageTop = vue.computed(() => (cropSize.value - imageHeight.value) / 2 + offsetY.value);
      const cropWindowStyle = vue.computed(() => ({ width: `${cropSize.value}px`, height: `${cropSize.value}px` }));
      const cropImageStyle = vue.computed(() => ({ width: `${imageWidth.value}px`, height: `${imageHeight.value}px`, transform: `translate(${imageLeft.value}px, ${imageTop.value}px)` }));
      onShow(load);
      async function load() {
        const [profileResult, activityStatsResult] = await Promise.allSettled([
          appApi.getMe(),
          appApi.getTransactionActivityStats()
        ]);
        if (profileResult.status === "fulfilled") {
          const profile = profileResult.value;
          authStore.setProfile(profile);
          avatar.value = profile.avatar || "";
          savedAvatar.value = avatar.value;
          previewFailed.value = false;
        } else {
          showRequestError(profileResult.reason);
        }
        if (activityStatsResult.status === "fulfilled")
          activityStats.value = activityStatsResult.value;
      }
      function openAvatarDialog() {
        previewFailed.value = false;
        avatarDialogVisible.value = true;
      }
      function closeAvatarDialog() {
        avatarDialogVisible.value = false;
      }
      function goCategories() {
        uni.navigateTo({ url: "/pages/ledger/categories" });
      }
      function chooseImage() {
        return new Promise((resolve, reject) => uni.chooseImage({ count: 1, sizeType: ["compressed"], sourceType: ["album", "camera"], success: ({ tempFilePaths }) => resolve(tempFilePaths[0]), fail: reject }));
      }
      function getImageInfo(src) {
        return new Promise((resolve, reject) => uni.getImageInfo({ src, success: resolve, fail: reject }));
      }
      async function startAvatarChange() {
        if (uploading.value || cropping.value)
          return;
        avatarDialogVisible.value = false;
        try {
          const filePath = await chooseImage();
          const info = await getImageInfo(filePath);
          cropSource.value = filePath;
          sourceWidth.value = info.width;
          sourceHeight.value = info.height;
          cropSize.value = Math.round(uni.getSystemInfoSync().windowWidth * 0.76);
          baseScale.value = Math.max(cropSize.value / info.width, cropSize.value / info.height);
          zoom.value = 1;
          offsetX.value = 0;
          offsetY.value = 0;
          cropping.value = true;
        } catch (error) {
          if (!String((error == null ? void 0 : error.errMsg) || (error == null ? void 0 : error.message) || "").includes("cancel"))
            showRequestError(error);
        }
      }
      function constrainOffset() {
        const horizontalLimit = Math.max(0, (imageWidth.value - cropSize.value) / 2);
        const verticalLimit = Math.max(0, (imageHeight.value - cropSize.value) / 2);
        offsetX.value = Math.min(horizontalLimit, Math.max(-horizontalLimit, offsetX.value));
        offsetY.value = Math.min(verticalLimit, Math.max(-verticalLimit, offsetY.value));
      }
      function startDrag(event) {
        var _a;
        const touch2 = (_a = event.touches) == null ? void 0 : _a[0];
        if (!touch2)
          return;
        dragStart.value = { x: touch2.clientX, y: touch2.clientY, offsetX: offsetX.value, offsetY: offsetY.value };
      }
      function moveDrag(event) {
        var _a;
        const touch2 = (_a = event.touches) == null ? void 0 : _a[0];
        if (!touch2 || !dragStart.value)
          return;
        offsetX.value = dragStart.value.offsetX + touch2.clientX - dragStart.value.x;
        offsetY.value = dragStart.value.offsetY + touch2.clientY - dragStart.value.y;
        constrainOffset();
      }
      function changeZoom(delta) {
        zoom.value = Math.min(3, Math.max(1, Number((zoom.value + delta).toFixed(1))));
        constrainOffset();
      }
      function canvasToTempFile() {
        const scale = 600 / cropSize.value;
        const context = uni.createCanvasContext("avatar-crop-canvas");
        context.clearRect(0, 0, 600, 600);
        context.drawImage(cropSource.value, imageLeft.value * scale, imageTop.value * scale, imageWidth.value * scale, imageHeight.value * scale);
        return new Promise((resolve, reject) => context.draw(false, () => uni.canvasToTempFilePath({ canvasId: "avatar-crop-canvas", destWidth: 600, destHeight: 600, quality: 0.9, success: ({ tempFilePath }) => resolve(tempFilePath), fail: reject })));
      }
      async function confirmCrop() {
        if (uploading.value)
          return;
        try {
          uploading.value = true;
          const filePath = await canvasToTempFile();
          avatar.value = await appApi.uploadImage(filePath);
          previewFailed.value = false;
          cropping.value = false;
          avatarDialogVisible.value = true;
          uni.showToast({ title: "上传成功，请确认保存", icon: "none" });
        } catch (error) {
          showRequestError(error);
        } finally {
          uploading.value = false;
        }
      }
      function cancelCrop() {
        cropping.value = false;
        cropSource.value = "";
        dragStart.value = null;
        avatarDialogVisible.value = true;
      }
      async function save() {
        if (!hasChanges.value || saving.value)
          return;
        saving.value = true;
        try {
          const profile = await appApi.updateMe({ avatar: avatar.value || null });
          authStore.setProfile(profile);
          savedAvatar.value = profile.avatar || "";
          avatar.value = savedAvatar.value;
          previewFailed.value = false;
          avatarDialogVisible.value = false;
          uni.showToast({ title: "头像已保存", icon: "success" });
        } catch (error) {
          showRequestError(error);
        } finally {
          saving.value = false;
        }
      }
      function logout() {
        uni.showModal({ title: "退出登录", content: "确定退出当前账号吗？", success: async ({ confirm }) => {
          if (!confirm)
            return;
          try {
            await appApi.logout();
          } catch {
          } finally {
            authStore.clear();
            uni.reLaunch({ url: "/pages/auth/login" });
          }
        } });
      }
      const __returned__ = { avatar, savedAvatar, uploading, saving, previewFailed, avatarDialogVisible, cropping, cropSource, cropSize, sourceWidth, sourceHeight, baseScale, zoom, offsetX, offsetY, dragStart, activityStats, initial, hasChanges, imageWidth, imageHeight, imageLeft, imageTop, cropWindowStyle, cropImageStyle, load, openAvatarDialog, closeAvatarDialog, goCategories, chooseImage, getImageInfo, startAvatarChange, constrainOffset, startDrag, moveDrag, changeZoom, canvasToTempFile, confirmCrop, cancelCrop, save, logout, computed: vue.computed, ref: vue.ref, get onShow() {
        return onShow;
      }, get appApi() {
        return appApi;
      }, get authStore() {
        return authStore;
      }, get showRequestError() {
        return showRequestError;
      } };
      Object.defineProperty(__returned__, "__isScriptSetup", { enumerable: false, value: true });
      return __returned__;
    }
  };
  function _sfc_render(_ctx, _cache, $props, $setup, $data, $options) {
    var _a, _b, _c;
    return vue.openBlock(), vue.createElementBlock("view", null, [
      vue.createElementVNode("view", { class: "profile-head" }, [
        vue.createElementVNode("view", {
          class: "avatar-trigger",
          onClick: $setup.openAvatarDialog
        }, [
          $setup.avatar && !$setup.previewFailed ? (vue.openBlock(), vue.createElementBlock("image", {
            key: 0,
            class: "avatar avatar-image",
            src: $setup.avatar,
            mode: "aspectFill",
            onError: _cache[0] || (_cache[0] = ($event) => $setup.previewFailed = true)
          }, null, 40, ["src"])) : (vue.openBlock(), vue.createElementBlock(
            "view",
            {
              key: 1,
              class: "avatar"
            },
            vue.toDisplayString($setup.initial),
            1
            /* TEXT */
          )),
          vue.createElementVNode("view", { class: "avatar-badge" }, "编辑")
        ]),
        vue.createElementVNode("view", null, [
          vue.createElementVNode(
            "text",
            { class: "username" },
            vue.toDisplayString(((_a = $setup.authStore.profile) == null ? void 0 : _a.username) || "用户"),
            1
            /* TEXT */
          ),
          vue.createElementVNode(
            "text",
            { class: "phone" },
            vue.toDisplayString(((_b = $setup.authStore.profile) == null ? void 0 : _b.phone) || ""),
            1
            /* TEXT */
          )
        ])
      ]),
      vue.createElementVNode("view", { class: "card activity-card" }, [
        vue.createElementVNode("text", { class: "activity-title" }, "记账足迹"),
        vue.createElementVNode("view", { class: "activity-stats" }, [
          vue.createElementVNode("view", { class: "activity-stat" }, [
            vue.createElementVNode(
              "text",
              { class: "activity-value" },
              vue.toDisplayString($setup.activityStats.totalBookkeepingDays ?? "--"),
              1
              /* TEXT */
            ),
            vue.createElementVNode("text", { class: "activity-label" }, "记账天数")
          ]),
          vue.createElementVNode("view", { class: "activity-stat" }, [
            vue.createElementVNode(
              "text",
              { class: "activity-value" },
              vue.toDisplayString($setup.activityStats.totalTransactionCount ?? "--"),
              1
              /* TEXT */
            ),
            vue.createElementVNode("text", { class: "activity-label" }, "记账笔数")
          ]),
          vue.createElementVNode("view", { class: "activity-stat" }, [
            vue.createElementVNode(
              "text",
              { class: "activity-value" },
              vue.toDisplayString($setup.activityStats.currentStreakDays ?? "--"),
              1
              /* TEXT */
            ),
            vue.createElementVNode("text", { class: "activity-label" }, "连续记账天数")
          ])
        ])
      ]),
      vue.createElementVNode("view", { class: "card info" }, [
        vue.createElementVNode("text", null, "当前身份"),
        vue.createElementVNode(
          "text",
          null,
          vue.toDisplayString(((_c = $setup.authStore.profile) == null ? void 0 : _c.role) || "USER"),
          1
          /* TEXT */
        )
      ]),
      vue.createElementVNode("view", {
        class: "card category-entry",
        onClick: $setup.goCategories
      }, [
        vue.createElementVNode("view", null, [
          vue.createElementVNode("text", { class: "entry-title" }, "分类管理"),
          vue.createElementVNode("text", { class: "entry-subtitle" }, "管理收入与支出分类")
        ]),
        vue.createElementVNode("text", { class: "entry-arrow" }, "›")
      ]),
      vue.createElementVNode("button", {
        class: "logout",
        onClick: $setup.logout
      }, "退出登录"),
      $setup.avatarDialogVisible ? (vue.openBlock(), vue.createElementBlock("view", {
        key: 0,
        class: "avatar-mask",
        onClick: vue.withModifiers($setup.closeAvatarDialog, ["self"])
      }, [
        vue.createElementVNode("view", { class: "avatar-dialog" }, [
          vue.createElementVNode("view", { class: "dialog-handle" }),
          vue.createElementVNode("text", { class: "dialog-title" }, "头像"),
          $setup.avatar && !$setup.previewFailed ? (vue.openBlock(), vue.createElementBlock("image", {
            key: 0,
            class: "dialog-avatar",
            src: $setup.avatar,
            mode: "aspectFill",
            onError: _cache[1] || (_cache[1] = ($event) => $setup.previewFailed = true)
          }, null, 40, ["src"])) : (vue.openBlock(), vue.createElementBlock(
            "view",
            {
              key: 1,
              class: "dialog-avatar dialog-avatar-placeholder"
            },
            vue.toDisplayString($setup.initial),
            1
            /* TEXT */
          )),
          vue.createElementVNode(
            "text",
            { class: "dialog-tip" },
            vue.toDisplayString($setup.hasChanges ? "新头像已上传，确认后将同步到个人资料。" : "选择一张照片，裁剪后更换头像。"),
            1
            /* TEXT */
          ),
          vue.createElementVNode("button", {
            class: "change-avatar",
            loading: $setup.uploading,
            onClick: $setup.startAvatarChange
          }, "更换头像", 8, ["loading"]),
          $setup.hasChanges ? (vue.openBlock(), vue.createElementBlock("button", {
            key: 2,
            class: "primary-button confirm-avatar",
            loading: $setup.saving,
            onClick: $setup.save
          }, "确认使用此头像", 8, ["loading"])) : vue.createCommentVNode("v-if", true),
          vue.createElementVNode("button", {
            class: "cancel-avatar",
            onClick: $setup.closeAvatarDialog
          }, "取消")
        ])
      ])) : vue.createCommentVNode("v-if", true),
      $setup.cropping ? (vue.openBlock(), vue.createElementBlock("view", {
        key: 1,
        class: "crop-mask"
      }, [
        vue.createElementVNode("view", { class: "crop-dialog" }, [
          vue.createElementVNode("text", { class: "crop-title" }, "裁剪头像"),
          vue.createElementVNode("text", { class: "crop-tip" }, "拖动图片调整位置，使用按钮调整缩放"),
          vue.createElementVNode(
            "view",
            {
              class: "crop-window",
              style: vue.normalizeStyle($setup.cropWindowStyle),
              onTouchstart: $setup.startDrag,
              onTouchmove: vue.withModifiers($setup.moveDrag, ["stop", "prevent"])
            },
            [
              vue.createElementVNode("image", {
                class: "crop-image",
                src: $setup.cropSource,
                style: vue.normalizeStyle($setup.cropImageStyle),
                mode: "scaleToFill"
              }, null, 12, ["src"])
            ],
            36
            /* STYLE, NEED_HYDRATION */
          ),
          vue.createElementVNode("view", { class: "crop-tools" }, [
            vue.createElementVNode("button", {
              class: "crop-control",
              disabled: $setup.zoom <= 1,
              onClick: _cache[2] || (_cache[2] = ($event) => $setup.changeZoom(-0.1))
            }, "缩小", 8, ["disabled"]),
            vue.createElementVNode(
              "text",
              null,
              vue.toDisplayString(Math.round($setup.zoom * 100)) + "%",
              1
              /* TEXT */
            ),
            vue.createElementVNode("button", {
              class: "crop-control",
              disabled: $setup.zoom >= 3,
              onClick: _cache[3] || (_cache[3] = ($event) => $setup.changeZoom(0.1))
            }, "放大", 8, ["disabled"])
          ]),
          vue.createElementVNode("view", { class: "crop-actions" }, [
            vue.createElementVNode("button", {
              class: "crop-cancel",
              onClick: $setup.cancelCrop
            }, "取消"),
            vue.createElementVNode("button", {
              class: "primary-button crop-confirm",
              loading: $setup.uploading,
              onClick: $setup.confirmCrop
            }, "完成裁剪", 8, ["loading"])
          ]),
          vue.createElementVNode("canvas", {
            "canvas-id": "avatar-crop-canvas",
            class: "crop-canvas",
            width: 600,
            height: 600
          })
        ])
      ])) : vue.createCommentVNode("v-if", true)
    ]);
  }
  const PagesProfileIndex = /* @__PURE__ */ _export_sfc(_sfc_main$1, [["render", _sfc_render], ["__scopeId", "data-v-f97f9319"], ["__file", "D:/code/mechiBookkeeping/frontend/src/pages/profile/index.vue"]]);
  __definePage("pages/auth/login", PagesAuthLogin);
  __definePage("pages/auth/register", PagesAuthRegister);
  __definePage("pages/ledger/index", PagesLedgerIndex);
  __definePage("pages/ledger/expense-statistics", PagesLedgerExpenseStatistics);
  __definePage("pages/ledger/transaction-form", PagesLedgerTransactionForm);
  __definePage("pages/ledger/categories", PagesLedgerCategories);
  __definePage("pages/chat/index", PagesChatIndex);
  __definePage("pages/profile/index", PagesProfileIndex);
  const _sfc_main = {
    onLaunch() {
      authStore.restore();
    }
  };
  const App = /* @__PURE__ */ _export_sfc(_sfc_main, [["__file", "D:/code/mechiBookkeeping/frontend/src/App.vue"]]);
  const LT = {
    Launch: "1",
    Hide: "3",
    Page: "11",
    Event: "21",
    Error: "31",
    Push: "101"
  };
  const CST = {
    ColdLaunch: 1,
    BackgroundTimeout: 2,
    PageInactiveTimeout: 3
  };
  const IEY = {
    No: 0,
    Yes: 1
  };
  function toIey(input) {
    if (input === true || input === 1 || input === "1")
      return IEY.Yes;
    return IEY.No;
  }
  function __awaiter(thisArg, _arguments, P, generator) {
    function adopt(value) {
      return value instanceof P ? value : new P(function(resolve) {
        resolve(value);
      });
    }
    return new (P || (P = Promise))(function(resolve, reject) {
      function fulfilled(value) {
        try {
          step(generator.next(value));
        } catch (e) {
          reject(e);
        }
      }
      function rejected(value) {
        try {
          step(generator["throw"](value));
        } catch (e) {
          reject(e);
        }
      }
      function step(result) {
        result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected);
      }
      step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
  }
  typeof SuppressedError === "function" ? SuppressedError : function(error, suppressed, message) {
    var e = new Error(message);
    return e.name = "SuppressedError", e.error = error, e.suppressed = suppressed, e;
  };
  const DEFAULT_MAX_LENGTH = 4096;
  const TRUNCATED_SUFFIX = "…[truncated]";
  function safeStringify(value, max = DEFAULT_MAX_LENGTH) {
    var _a;
    if (value === void 0)
      return "";
    let raw;
    if (typeof value === "string") {
      raw = value;
    } else {
      const seen = /* @__PURE__ */ new WeakSet();
      try {
        raw = (_a = JSON.stringify(value, (_key, val) => {
          if (typeof val === "object" && val !== null) {
            if (seen.has(val))
              return "[Circular]";
            seen.add(val);
          }
          if (typeof val === "bigint")
            return val.toString();
          if (typeof val === "function")
            return `[Function ${val.name || "anonymous"}]`;
          return val;
        })) !== null && _a !== void 0 ? _a : "";
      } catch (e) {
        raw = `[Unserializable: ${e.message}]`;
      }
    }
    if (raw.length > max) {
      return raw.slice(0, Math.max(0, max - TRUNCATED_SUFFIX.length)) + TRUNCATED_SUFFIX;
    }
    return raw;
  }
  function tryRun(fn, fallback) {
    try {
      return fn();
    } catch (_a) {
      return fallback;
    }
  }
  function withRetry(fn, opts) {
    return __awaiter(this, void 0, void 0, function* () {
      var _a;
      const total = Math.max(1, Math.floor(opts.times));
      const sleep = (_a = opts.sleep) !== null && _a !== void 0 ? _a : defaultSleep;
      let lastErr;
      for (let attempt = 1; attempt <= total; attempt++) {
        try {
          return yield fn();
        } catch (e) {
          lastErr = e;
          if (attempt >= total)
            break;
          yield sleep(opts.baseDelayMs * Math.pow(2, attempt - 1));
        }
      }
      throw lastErr;
    });
  }
  function defaultSleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
  function isUsableUniRuntime(candidate) {
    if (candidate == null || typeof candidate !== "object")
      return false;
    const u = candidate;
    return typeof u.getStorageSync === "function" || typeof u.onCreateVueApp === "function" || typeof u.request === "function" || typeof u.onAppShow === "function";
  }
  function getModuleUniCandidate() {
    if (typeof uni === "undefined" || uni == null || typeof uni !== "object") {
      return void 0;
    }
    return uni;
  }
  function getWindowObject() {
    try {
      const w = Function('return typeof window !== "undefined" ? window : undefined')();
      return w != null ? w : void 0;
    } catch (_a) {
      return void 0;
    }
  }
  function getGlobalObject() {
    if (typeof globalThis !== "undefined" && globalThis != null) {
      return globalThis;
    }
    if (typeof global !== "undefined" && global != null) {
      return global;
    }
    if (typeof self !== "undefined" && self != null) {
      return self;
    }
    const win = getWindowObject();
    if (win)
      return win;
    return {};
  }
  function buildInjectedUniRuntime() {
    try {
      const out = {};
      const pick = (name, fn) => {
        if (typeof fn === "function")
          out[name] = fn;
      };
      pick("getStorageSync", uni.getStorageSync);
      pick("setStorageSync", uni.setStorageSync);
      pick("removeStorageSync", uni.removeStorageSync);
      pick("getSystemInfoSync", uni.getSystemInfoSync);
      pick("getDeviceInfo", uni.getDeviceInfo);
      pick("getAppBaseInfo", uni.getAppBaseInfo);
      pick("getWindowInfo", uni.getWindowInfo);
      pick("getNetworkType", uni.getNetworkType);
      pick("request", uni.request);
      pick("onAppShow", uni.onAppShow);
      pick("offAppShow", uni.offAppShow);
      pick("onAppHide", uni.onAppHide);
      pick("offAppHide", uni.offAppHide);
      pick("onAppLaunch", uni.onAppLaunch);
      pick("offAppLaunch", uni.offAppLaunch);
      pick("getLaunchOptionsSync", uni.getLaunchOptionsSync);
      pick("addInterceptor", uni.addInterceptor);
      pick("removeInterceptor", uni.removeInterceptor);
      pick("getPushClientId", uni.getPushClientId);
      pick("getAccountInfoSync", uni.getAccountInfoSync);
      pick("onCreateVueApp", uni.onCreateVueApp);
      return Object.keys(out).length > 0 ? out : void 0;
    } catch (_e) {
      return void 0;
    }
  }
  function probeUniRuntime() {
    const globalThisAvailable = typeof globalThis !== "undefined";
    const g = getGlobalObject();
    const globalUni = g.uni;
    const globalThisHasUni = globalUni != null && typeof globalUni === "object";
    const globalThisUniStub = globalThisHasUni && !isUsableUniRuntime(globalUni);
    const moduleUni = getModuleUniCandidate();
    const moduleUniDefined = moduleUni != null;
    if (isUsableUniRuntime(globalUni)) {
      return {
        resolved: true,
        source: "globalThis",
        globalThisHasUni: true,
        globalThisUniStub: false,
        moduleUniDefined,
        globalThisAvailable,
        uni: globalUni
      };
    }
    if (isUsableUniRuntime(moduleUni)) {
      return {
        resolved: true,
        source: "module",
        globalThisHasUni,
        globalThisUniStub,
        moduleUniDefined: true,
        globalThisAvailable,
        uni: moduleUni
      };
    }
    const injectedUni = buildInjectedUniRuntime();
    if (isUsableUniRuntime(injectedUni)) {
      return {
        resolved: true,
        source: "injected",
        globalThisHasUni,
        globalThisUniStub,
        moduleUniDefined,
        globalThisAvailable,
        uni: injectedUni
      };
    }
    return {
      resolved: false,
      source: "none",
      globalThisHasUni,
      globalThisUniStub,
      moduleUniDefined,
      globalThisAvailable,
      uni: void 0
    };
  }
  function resolveUniRuntime() {
    const probe = probeUniRuntime();
    return probe.resolved ? probe.uni : void 0;
  }
  const TAG = "[uni统计 2.0]";
  let runtimeDebug;
  let muteNonDebug;
  function preferSingleLineConsole() {
    return isAndroidOrIosRuntime();
  }
  function isAndroidOrIosRuntime() {
    var _a, _b, _c, _d, _e, _f, _g, _h;
    const raw = (_a = "app") !== null && _a !== void 0 ? _a : "";
    const g = getGlobalObject();
    if (raw === "app" || raw === "app-plus" || raw === "app-harmony") {
      const n2 = (_d = (_c = (_b = g.plus) === null || _b === void 0 ? void 0 : _b.os) === null || _c === void 0 ? void 0 : _c.name) === null || _d === void 0 ? void 0 : _d.toLowerCase();
      if (!n2)
        return false;
      if (n2.includes("android"))
        return true;
      if (n2 === "ios" || n2.includes("iphone"))
        return true;
      return false;
    }
    if (raw.startsWith("mp-")) {
      try {
        const p = (_h = (_g = (_f = (_e = g.uni) === null || _e === void 0 ? void 0 : _e.getSystemInfoSync) === null || _f === void 0 ? void 0 : _f.call(_e)) === null || _g === void 0 ? void 0 : _g.platform) === null || _h === void 0 ? void 0 : _h.toLowerCase();
        return p === "android" || p === "ios";
      } catch (_j) {
        return false;
      }
    }
    return false;
  }
  function stringifyObjectArgForNative(value) {
    if (value === null || value === void 0)
      return value;
    if (typeof value !== "object")
      return value;
    if (value instanceof Error)
      return `${value.name}: ${value.message}`;
    return safeStringify(value);
  }
  function formatLogArgForNativeConsole(value) {
    if (value === null)
      return "null";
    if (value === void 0)
      return "undefined";
    if (typeof value === "string")
      return value;
    if (typeof value === "number" || typeof value === "boolean") {
      return String(value);
    }
    if (typeof value === "bigint")
      return String(value);
    if (typeof value === "symbol") {
      try {
        return value.toString();
      } catch (_a) {
        return "?";
      }
    }
    if (typeof value === "function") {
      const fn = value;
      return `[Function ${fn.name || "anonymous"}]`;
    }
    if (typeof value === "object") {
      if (value instanceof Error)
        return `${value.name}: ${value.message}`;
      return safeStringify(value);
    }
    return String(value);
  }
  function isNonDebugMuted() {
    if (muteNonDebug !== void 0)
      return muteNonDebug;
    return false;
  }
  function setMuteNonDebug(value) {
    muteNonDebug = value;
  }
  function emitConsole(method, args) {
    if (method !== "log" && isNonDebugMuted())
      return;
    const fn = console[method];
    if (!preferSingleLineConsole()) {
      fn.call(console, TAG, ...args);
      return;
    }
    const mapped = isAndroidOrIosRuntime() ? args.map(stringifyObjectArgForNative) : args;
    if (mapped.length === 0) {
      fn.call(console, TAG);
      return;
    }
    const body = mapped.map(formatLogArgForNativeConsole).join(" ");
    fn.call(console, `${TAG} ${body}`);
  }
  function isDebug() {
    if (runtimeDebug !== void 0)
      return runtimeDebug;
    const v = "false";
    return v === true;
  }
  function setDebug(value) {
    runtimeDebug = value;
  }
  const logger = {
    debug(...args) {
      if (!isDebug())
        return;
      emitConsole("log", args);
    },
    info(...args) {
      emitConsole("info", args);
    },
    warn(...args) {
      emitConsole("warn", args);
    },
    error(...args) {
      emitConsole("error", args);
    },
    setDebug,
    isDebug,
    setMuteNonDebug
  };
  const NAMESPACE_ROOT = "UNI_STAT_DATA";
  const LEGACY_NAMESPACE_ROOT = "$$STAT__DBDATA";
  const cache = /* @__PURE__ */ new Map();
  const knownKeys = /* @__PURE__ */ new Set();
  function fullKey(key) {
    const appid = "__UNI__DAB5E07";
    return `${NAMESPACE_ROOT}:${appid}:${key}`;
  }
  function getUni$a() {
    const raw = resolveUniRuntime();
    const u = raw != null && typeof raw === "object" ? raw : void 0;
    if (!u || typeof u.getStorageSync !== "function") {
      throw new Error("[uni统计 2.0] uni storage API is not available");
    }
    return u;
  }
  function get(key) {
    const fk = fullKey(key);
    if (cache.has(fk))
      return cache.get(fk);
    try {
      const raw = getUni$a().getStorageSync(fk);
      if (raw === "" || raw === null || raw === void 0) {
        cache.set(fk, void 0);
        return void 0;
      }
      cache.set(fk, raw);
      knownKeys.add(fk);
      return raw;
    } catch (_a) {
      return void 0;
    }
  }
  function safeRead(key) {
    const fk = fullKey(key);
    if (cache.has(fk))
      return { ok: true, value: cache.get(fk) };
    try {
      const raw = getUni$a().getStorageSync(fk);
      if (raw === "" || raw === null || raw === void 0) {
        cache.set(fk, void 0);
        return { ok: true, value: void 0 };
      }
      cache.set(fk, raw);
      knownKeys.add(fk);
      return { ok: true, value: raw };
    } catch (_a) {
      return { ok: false, value: void 0 };
    }
  }
  function set(key, value) {
    const fk = fullKey(key);
    if (value === void 0) {
      remove(key);
      return;
    }
    cache.set(fk, value);
    knownKeys.add(fk);
    try {
      getUni$a().setStorageSync(fk, value);
    } catch (_a) {
    }
  }
  function remove(key) {
    const fk = fullKey(key);
    cache.set(fk, void 0);
    try {
      getUni$a().removeStorageSync(fk);
    } catch (_a) {
    }
  }
  function batchGet(keys) {
    const out = {};
    for (const k of keys)
      out[k] = get(k);
    return out;
  }
  function batchSet(entries) {
    for (const k of Object.keys(entries))
      set(k, entries[k]);
  }
  function clearNamespace() {
    let uni2;
    try {
      uni2 = getUni$a();
    } catch (_a) {
    }
    for (const fk of Array.from(knownKeys)) {
      try {
        uni2 === null || uni2 === void 0 ? void 0 : uni2.removeStorageSync(fk);
      } catch (_b) {
      }
      cache.set(fk, void 0);
    }
    knownKeys.clear();
  }
  function __resetCache() {
    cache.clear();
    knownKeys.clear();
  }
  const storage = {
    get,
    set,
    remove,
    safeRead,
    batchGet,
    batchSet,
    clearNamespace,
    __resetCache
  };
  const KEY_FVTS = "visit:fvts";
  const KEY_LVTS = "visit:lvts";
  const KEY_TVC = "visit:tvc";
  const EMPTY_SNAPSHOT = {
    fvts: 0,
    lvts: 0,
    tvc: 0,
    isNewUser: true,
    degraded: false
  };
  let loaded = null;
  let pending = null;
  let pendingRenewal = null;
  let committed = null;
  let lastBuilt = null;
  let buildCalledInProcess = false;
  function toNum(v) {
    if (typeof v === "number" && Number.isFinite(v) && v >= 0)
      return v;
    if (typeof v === "string" && v.length > 0) {
      const n2 = Number(v);
      if (Number.isFinite(n2) && n2 >= 0)
        return n2;
    }
    return 0;
  }
  function isLikelyFreshDevice(snap) {
    return snap.fvts === 0 && snap.lvts === 0 && snap.tvc === 0;
  }
  function isTrustworthyNewUser(snap) {
    if (!snap.isNewUser)
      return false;
    return !snap.degraded || isLikelyFreshDevice(snap);
  }
  function loadVisitSnapshot() {
    const fvtsR = storage.safeRead(KEY_FVTS);
    const lvtsR = storage.safeRead(KEY_LVTS);
    const tvcR = storage.safeRead(KEY_TVC);
    const degraded = !fvtsR.ok || !lvtsR.ok || !tvcR.ok;
    const fvts = toNum(fvtsR.value);
    const lvts = toNum(lvtsR.value);
    const tvc = toNum(tvcR.value);
    const snapshot = {
      fvts,
      lvts,
      tvc,
      isNewUser: lvts === 0,
      degraded
    };
    if (degraded) {
      const likelyFresh = fvts === 0 && lvts === 0 && tvc === 0 && snapshot.isNewUser;
      if (!likelyFresh) {
        logger.warn("[uni统计 2.0] visit snapshot degraded; some storage keys read failed");
      }
    }
    loaded = snapshot;
    return snapshot;
  }
  function ensureLoaded() {
    if (!loaded)
      loaded = EMPTY_SNAPSHOT;
    return loaded;
  }
  function persistNewUserBaseline(now) {
    storage.set(KEY_FVTS, now);
    storage.set(KEY_LVTS, now);
    storage.set(KEY_TVC, 1);
    const baseline = {
      fvts: now,
      lvts: now,
      tvc: 1,
      isNewUser: false,
      degraded: false
    };
    loaded = baseline;
    committed = baseline;
  }
  function buildVisitFields(now) {
    const snap = ensureLoaded();
    if (buildCalledInProcess && lastBuilt) {
      logger.warn("[uni统计 2.0] buildVisitFields() called twice in same process; returning cached fields");
      return Object.assign({}, lastBuilt);
    }
    buildCalledInProcess = true;
    if (isTrustworthyNewUser(snap)) {
      pending = { fvts: now, lvts: 0, tvc: 1, now };
      persistNewUserBaseline(now);
    } else if (snap.isNewUser) {
      logger.warn("[uni统计 2.0] visit degraded: lvts 读取失败但检测到历史数据，按老用户处理以避免新增虚高");
      const fvts = snap.fvts > 0 ? snap.fvts : now;
      pending = { fvts, lvts: fvts, tvc: snap.tvc + 1, now };
    } else {
      pending = {
        fvts: snap.fvts,
        lvts: snap.lvts,
        tvc: snap.tvc + 1,
        now
      };
    }
    lastBuilt = { fvts: pending.fvts, lvts: pending.lvts, tvc: pending.tvc };
    return Object.assign({}, lastBuilt);
  }
  function buildVisitFieldsForSessionRenewal(now) {
    let fvts;
    let lvts;
    let tvc;
    if (committed) {
      fvts = committed.fvts;
      lvts = committed.lvts;
      tvc = committed.tvc + 1;
    } else if (lastBuilt) {
      fvts = lastBuilt.fvts;
      lvts = lastBuilt.lvts !== 0 ? lastBuilt.lvts : lastBuilt.fvts;
      tvc = lastBuilt.tvc;
    } else {
      const snap = ensureLoaded();
      if (isTrustworthyNewUser(snap)) {
        fvts = now;
        lvts = 0;
        tvc = 1;
        persistNewUserBaseline(now);
      } else if (snap.isNewUser) {
        fvts = snap.fvts > 0 ? snap.fvts : now;
        lvts = fvts;
        tvc = snap.tvc + 1;
      } else {
        fvts = snap.fvts;
        lvts = snap.lvts;
        tvc = snap.tvc + 1;
      }
    }
    pendingRenewal = { fvts, lvts, tvc, now };
    return { fvts, lvts, tvc };
  }
  function commitVisitOnAck(now) {
    if (pending) {
      const snap = ensureLoaded();
      const newFvts2 = snap.fvts === 0 ? now : snap.fvts;
      const newLvts2 = now;
      const newTvc2 = pending.tvc;
      storage.set(KEY_FVTS, newFvts2);
      storage.set(KEY_LVTS, newLvts2);
      storage.set(KEY_TVC, newTvc2);
      committed = {
        fvts: newFvts2,
        lvts: newLvts2,
        tvc: newTvc2,
        isNewUser: false,
        degraded: false
      };
      loaded = committed;
      pending = null;
      return;
    }
    if (!pendingRenewal)
      return;
    const newFvts = pendingRenewal.fvts;
    const newLvts = now;
    const newTvc = pendingRenewal.tvc;
    storage.set(KEY_FVTS, newFvts);
    storage.set(KEY_LVTS, newLvts);
    storage.set(KEY_TVC, newTvc);
    committed = {
      fvts: newFvts,
      lvts: newLvts,
      tvc: newTvc,
      isNewUser: false,
      degraded: false
    };
    loaded = committed;
    pendingRenewal = null;
  }
  function rollbackPendingVisit() {
    pending = null;
    pendingRenewal = null;
  }
  const KEY_ENTRY = "session:entryRoute";
  let cached$3;
  let entryDeparted = false;
  function markEntryPage(route) {
    if (!route)
      return;
    const existing = getEntryRoute();
    if (existing)
      return;
    storage.set(KEY_ENTRY, route);
    cached$3 = route;
  }
  function getEntryRoute() {
    if (cached$3 !== void 0)
      return cached$3 || void 0;
    const r = storage.safeRead(KEY_ENTRY);
    if (!r.ok)
      return void 0;
    if (typeof r.value === "string" && r.value.length > 0) {
      cached$3 = r.value;
      return r.value;
    }
    cached$3 = "";
    return void 0;
  }
  function isEntry(route) {
    if (!route)
      return false;
    const entry = getEntryRoute();
    return entry === route;
  }
  function isEntryForIey(route) {
    if (entryDeparted)
      return false;
    return isEntry(route);
  }
  function markEntryDeparted() {
    entryDeparted = true;
  }
  function clearEntry() {
    cached$3 = "";
    entryDeparted = false;
    storage.remove(KEY_ENTRY);
  }
  let titleMapCache;
  function getVue3TitleMap() {
    if (titleMapCache)
      return titleMapCache;
    titleMapCache = {};
    try {
      const raw = '{"pages/auth/login":"登录","pages/auth/register":"注册","pages/ledger/index":"账本","pages/ledger/expense-statistics":"费用统计","pages/ledger/transaction-form":"新增流水","pages/ledger/categories":"收支分类","pages/chat/index":"AI 助手","pages/profile/index":"我的"}';
      if (typeof raw !== "string" || !raw)
        ;
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        titleMapCache = parsed;
      }
    } catch (_a) {
      titleMapCache = {};
    }
    return titleMapCache;
  }
  function getTitleMap() {
    let map = {};
    map = getVue3TitleMap();
    return map;
  }
  function getPagesJsonNavigationTitle(routePath) {
    if (!routePath || typeof routePath !== "string")
      return "";
    const pathOnly = routePath.split("?")[0].trim();
    if (!pathOnly)
      return "";
    const map = getTitleMap();
    let result = "";
    const keys = [pathOnly];
    if (pathOnly.startsWith("/")) {
      keys.push(pathOnly.slice(1));
    } else {
      keys.push(`/${pathOnly}`);
    }
    for (const k of keys) {
      const v = map[k];
      if (typeof v === "string" && v.length > 0) {
        result = v;
        break;
      }
    }
    return result;
  }
  const state$2 = { page: "", config: "", report: "" };
  function setPageTitle(title) {
    state$2.page = typeof title === "string" ? title : "";
  }
  function setConfigTitle(title) {
    state$2.config = typeof title === "string" ? title : "";
  }
  function setReportTitle(title) {
    state$2.report = typeof title === "string" ? title : "";
  }
  function getCurrentTitle() {
    return { ttn: state$2.page, ttpj: state$2.config, ttc: state$2.report };
  }
  function clearPageTitle() {
    state$2.page = "";
  }
  function nowMs() {
    return Date.now();
  }
  function nowSec() {
    return Math.floor(Date.now() / 1e3);
  }
  function clampUrlrefStaySec(deltaSec) {
    const d = deltaSec > 0 ? deltaSec : 0;
    return d < 1 ? 1 : d;
  }
  function normalizeStatOsP(info) {
    var _a, _b, _c, _d, _e;
    const fromToken = (raw) => {
      const s2 = raw.toLowerCase().trim();
      if (!s2)
        return "";
      if (s2 === "devtools")
        return "";
      if (s2 === "android")
        return "android";
      if (s2 === "ios" || s2 === "iphone")
        return "ios";
      if (s2.includes("android"))
        return "android";
      if (s2.includes("iphone") || s2 === "iphone os" || /\bios\b/.test(s2))
        return "ios";
      if (s2.includes("harmony") || s2 === "ohos" || s2 === "openharmony")
        return "harmonyos";
      if (s2.includes("windows") || s2 === "windows_nt")
        return "windows";
      if (s2 === "mac" || s2 === "darwin" || s2.includes("mac os") || s2 === "macos")
        return "macos";
      if (s2.includes("linux") && !s2.includes("android"))
        return "linux";
      return "";
    };
    const p0 = fromToken((_a = info.platform) !== null && _a !== void 0 ? _a : "");
    if (p0)
      return p0;
    const p1 = fromToken((_b = info.osName) !== null && _b !== void 0 ? _b : "");
    if (p1)
      return p1;
    const sys = ((_c = info.system) !== null && _c !== void 0 ? _c : "").toLowerCase();
    if (sys.includes("android"))
      return "android";
    if (sys.includes("iphone") || /\bios\b/.test(sys))
      return "ios";
    if (sys.includes("harmony") || sys.includes("ohos"))
      return "harmonyos";
    if (sys.includes("windows"))
      return "windows";
    if (sys.includes("mac os") || sys.includes("darwin"))
      return "macos";
    if (sys.includes("linux"))
      return "linux";
    const plus2 = getGlobalObject().plus;
    const p2 = fromToken((_e = (_d = plus2 === null || plus2 === void 0 ? void 0 : plus2.os) === null || _d === void 0 ? void 0 : _d.name) !== null && _e !== void 0 ? _e : "");
    if (p2)
      return p2;
    return "";
  }
  function uniPlatformMpAliRaw() {
    const parts = ["y", "a", "p", "mp-ali"];
    return [...parts].reverse().join("");
  }
  const PLATFORM_MAP = {
    app: "n",
    "app-plus": "n",
    "app-harmony": "n",
    "mp-harmony": "mhm",
    h5: "h5",
    "mp-weixin": "wx",
    [uniPlatformMpAliRaw()]: "ali",
    "mp-baidu": "bd",
    "mp-toutiao": "tt",
    "mp-qq": "qq",
    "mp-kuaishou": "ks",
    "mp-lark": "lark",
    "mp-xhs": "xhs",
    "mp-jd": "jd",
    "quickapp-native": "qn",
    "quickapp-webview": "qw"
  };
  function getRawPlatform() {
    var _a;
    return (_a = "app") !== null && _a !== void 0 ? _a : "";
  }
  function getPlatform() {
    var _a;
    const raw = getRawPlatform();
    const mapped = PLATFORM_MAP[raw];
    if (!mapped)
      return "unknown";
    if (mapped === "ali") {
      const my = getGlobalObject().my;
      if (((_a = my === null || my === void 0 ? void 0 : my.env) === null || _a === void 0 ? void 0 : _a.clientName) === "dingtalk")
        return "dt";
      return "ali";
    }
    return mapped;
  }
  function isApp() {
    const raw = getRawPlatform();
    return raw === "app" || raw === "app-plus" || raw === "app-harmony";
  }
  function isMp() {
    return getRawPlatform().startsWith("mp-");
  }
  function isH5() {
    return getRawPlatform() === "h5";
  }
  function isNvue() {
    return Boolean(getGlobalObject().__NVUE__);
  }
  const STORAGE_KEY_UUID = "device:uuid";
  const WEB_UUID_KEY = "__DC_STAT_UUID";
  let cachedUuid = null;
  function preferGetDeviceInfoDeviceIdFirst() {
    if (isApp() || isH5())
      return true;
    return getRawPlatform() === "mp-weixin";
  }
  function readSysDeviceId() {
    const root = resolveUniRuntime();
    const u = root != null && typeof root === "object" ? root : void 0;
    if (!u || typeof u.getSystemInfoSync !== "function")
      return "";
    return tryRun(() => {
      var _a;
      return (_a = u.getSystemInfoSync().deviceId) !== null && _a !== void 0 ? _a : "";
    }, "");
  }
  function readGetDeviceInfoDeviceId() {
    const root = resolveUniRuntime();
    const u = root != null && typeof root === "object" ? root : void 0;
    if (!u || typeof u.getDeviceInfo !== "function")
      return "";
    return tryRun(() => {
      var _a;
      return (_a = u.getDeviceInfo().deviceId) !== null && _a !== void 0 ? _a : "";
    }, "");
  }
  function generateAnonUuid() {
    const ms = nowMs();
    const rnd = Math.floor(Math.random() * 1e6).toString().padStart(6, "0");
    return `${ms}${rnd}`;
  }
  function persistUuid(uuid) {
    tryRun(() => storage.set(STORAGE_KEY_UUID, uuid), void 0);
  }
  function getWebLocalStorage() {
    return tryRun(() => {
      const g = getGlobalObject();
      if (g.navigator && g.navigator.cookieEnabled === false)
        return void 0;
      const ls = g.localStorage;
      if (ls && typeof ls.getItem === "function" && typeof ls.setItem === "function") {
        return ls;
      }
      return void 0;
    }, void 0);
  }
  function readWebDeviceId() {
    const ls = getWebLocalStorage();
    if (!ls)
      return "";
    return tryRun(() => {
      const v = ls.getItem(WEB_UUID_KEY);
      return typeof v === "string" ? v : "";
    }, "");
  }
  function writeWebDeviceId(uuid) {
    const ls = getWebLocalStorage();
    if (!ls)
      return;
    tryRun(() => ls.setItem(WEB_UUID_KEY, uuid), void 0);
  }
  function resolveDeviceIdFromUni() {
    if (preferGetDeviceInfoDeviceIdFirst()) {
      const fromDeviceInfo = readGetDeviceInfoDeviceId();
      if (fromDeviceInfo)
        return fromDeviceInfo;
    }
    return readSysDeviceId();
  }
  function getUuid() {
    if (cachedUuid)
      return cachedUuid;
    if (isH5()) {
      const fromWeb = readWebDeviceId();
      if (fromWeb) {
        cachedUuid = fromWeb;
        return cachedUuid;
      }
    }
    const fromDevice = resolveDeviceIdFromUni();
    if (fromDevice) {
      persistUuid(fromDevice);
      if (isH5())
        writeWebDeviceId(fromDevice);
      cachedUuid = fromDevice;
      return cachedUuid;
    }
    const storedRead = storage.safeRead(STORAGE_KEY_UUID);
    if (storedRead.ok) {
      const stored = storedRead.value;
      if (typeof stored === "string" && stored.length > 0) {
        if (stored.startsWith("device-anon-")) {
          const upgraded = generateAnonUuid();
          persistUuid(upgraded);
          if (isH5())
            writeWebDeviceId(upgraded);
          cachedUuid = upgraded;
          return cachedUuid;
        }
        cachedUuid = stored;
        return cachedUuid;
      }
      const generated = generateAnonUuid();
      persistUuid(generated);
      if (isH5())
        writeWebDeviceId(generated);
      cachedUuid = generated;
      return cachedUuid;
    }
    const ephemeral = generateAnonUuid();
    if (isH5()) {
      writeWebDeviceId(ephemeral);
      cachedUuid = ephemeral;
      return cachedUuid;
    }
    return ephemeral;
  }
  const SUFFIX_HEAD_LEN = 8;
  const SUFFIX_TAIL_LEN = 4;
  function randomPart(len) {
    const r = Math.random().toString(36).slice(2, 2 + len);
    return r.length >= len ? r : r.padEnd(len, "0");
  }
  function sessionInstanceSuffix() {
    return `${randomPart(SUFFIX_HEAD_LEN)}-${randomPart(SUFFIX_TAIL_LEN)}`;
  }
  function anonNumericBody() {
    const ms = nowMs();
    const rnd = Math.floor(Math.random() * 1e6).toString().padStart(6, "0");
    return `${ms}${rnd}`;
  }
  function genSid(uuid) {
    if (uuid && uuid.length > 0) {
      return `${uuid}-${sessionInstanceSuffix()}`;
    }
    return `${anonNumericBody()}-${sessionInstanceSuffix()}`;
  }
  const KEY_SID = "session:id";
  const KEY_SST = "session:start";
  const KEY_SCT = "session:sct";
  const KEY_SEQ = "session:seq";
  const KEY_LAST_ACTIVE = "session:lastActive";
  const KEY_BG_TS = "session:bgTs";
  const KEY_LAST_SCENE = "session:lastScene";
  const DEFAULT_CONFIG = {
    backgroundTimeoutSec: 300,
    pageInactiveTimeoutSec: 1800
  };
  let config$1 = Object.assign({}, DEFAULT_CONFIG);
  let cached$2 = null;
  function configure$1(c) {
    config$1 = Object.assign({}, DEFAULT_CONFIG, c);
  }
  function readNum(key) {
    const r = storage.safeRead(key);
    if (!r.ok)
      return 0;
    const v = r.value;
    if (typeof v === "number" && Number.isFinite(v) && v >= 0)
      return v;
    if (typeof v === "string" && v.length > 0) {
      const n2 = Number(v);
      if (Number.isFinite(n2) && n2 >= 0)
        return n2;
    }
    return 0;
  }
  function readStr(key) {
    const r = storage.safeRead(key);
    if (!r.ok)
      return "";
    return typeof r.value === "string" ? r.value : "";
  }
  function elapsedNonNeg(now, from) {
    const diff = now - from;
    return diff > 0 ? diff : 0;
  }
  function loadFromStorage() {
    const sid = readStr(KEY_SID);
    if (!sid)
      return null;
    return {
      sid,
      sst: readNum(KEY_SST),
      sct: readNum(KEY_SCT) || CST.ColdLaunch,
      seq: readNum(KEY_SEQ),
      lastActive: readNum(KEY_LAST_ACTIVE),
      bgTs: readNum(KEY_BG_TS),
      lastScene: readStr(KEY_LAST_SCENE)
    };
  }
  function ensureCache() {
    if (cached$2 !== null)
      return cached$2;
    cached$2 = loadFromStorage();
    return cached$2;
  }
  function createNew(now, sct, scene) {
    const sid = genSid(getUuid());
    const next = {
      sid,
      sst: now,
      sct,
      seq: 0,
      lastActive: now,
      bgTs: 0,
      lastScene: scene
    };
    storage.set(KEY_SID, sid);
    storage.set(KEY_SST, now);
    storage.set(KEY_SCT, sct);
    storage.set(KEY_SEQ, 0);
    storage.set(KEY_LAST_ACTIVE, now);
    storage.set(KEY_BG_TS, 0);
    storage.set(KEY_LAST_SCENE, scene);
    cached$2 = next;
    return next;
  }
  function ensureSession(t, ctx) {
    const { now, scene = "" } = ctx;
    const snap = ensureCache();
    if (t === "cold_launch") {
      const created = createNew(now, CST.ColdLaunch, scene);
      return { snapshot: created, isNew: true, cst: CST.ColdLaunch };
    }
    if (!snap) {
      const created = createNew(now, CST.ColdLaunch, scene);
      return { snapshot: created, isNew: true, cst: CST.ColdLaunch };
    }
    if (t === "app_show") {
      const enterCandidates = [];
      if (ctx.backgroundEnteredAt && ctx.backgroundEnteredAt > 0) {
        enterCandidates.push(ctx.backgroundEnteredAt);
      }
      if (snap.bgTs > 0) {
        enterCandidates.push(snap.bgTs);
      }
      const enterTs = enterCandidates.length > 0 ? Math.min(...enterCandidates) : 0;
      const elapsed2 = enterTs > 0 ? elapsedNonNeg(now, enterTs) : elapsedNonNeg(now, snap.lastActive);
      const sceneChanged = !!scene && !!snap.lastScene && scene !== snap.lastScene;
      const fromBackground = enterTs > 0;
      if (sceneChanged || fromBackground && elapsed2 >= config$1.backgroundTimeoutSec) {
        const created = createNew(now, CST.BackgroundTimeout, scene);
        return { snapshot: created, isNew: true, cst: CST.BackgroundTimeout };
      }
      touch(now);
      storage.set(KEY_BG_TS, 0);
      if (cached$2)
        cached$2.bgTs = 0;
      return { snapshot: cached$2, isNew: false, cst: 0 };
    }
    if (t === "wx_scene_changed") {
      if (scene && scene !== snap.lastScene) {
        const created = createNew(now, CST.BackgroundTimeout, scene);
        return { snapshot: created, isNew: true, cst: CST.BackgroundTimeout };
      }
      return { snapshot: snap, isNew: false, cst: 0 };
    }
    const elapsed = elapsedNonNeg(now, snap.lastActive);
    if (elapsed >= config$1.pageInactiveTimeoutSec) {
      const created = createNew(now, CST.PageInactiveTimeout, scene || snap.lastScene);
      return { snapshot: created, isNew: true, cst: CST.PageInactiveTimeout };
    }
    touch(now);
    return { snapshot: cached$2, isNew: false, cst: 0 };
  }
  function markBackground(now) {
    if (!cached$2)
      cached$2 = loadFromStorage();
    if (!cached$2)
      return;
    storage.set(KEY_BG_TS, now);
    cached$2.bgTs = now;
  }
  function touch(now) {
    if (!cached$2)
      cached$2 = loadFromStorage();
    if (!cached$2)
      return;
    storage.set(KEY_LAST_ACTIVE, now);
    cached$2.lastActive = now;
  }
  function nextSeq() {
    if (!cached$2)
      cached$2 = loadFromStorage();
    if (!cached$2)
      return 0;
    const next = cached$2.seq + 1;
    cached$2.seq = next;
    storage.set(KEY_SEQ, next);
    return next;
  }
  function getSnapshot() {
    return ensureCache();
  }
  function syncLastScene(scene) {
    if (!scene)
      return;
    if (!cached$2)
      cached$2 = loadFromStorage();
    if (!cached$2)
      return;
    storage.set(KEY_LAST_SCENE, scene);
    cached$2.lastScene = scene;
  }
  function getPageVmType(vm) {
    var _a, _b, _c, _d, _e, _f, _g, _h;
    if (!vm)
      return null;
    const internalMpType = (_c = (_b = (_a = vm.$) === null || _a === void 0 ? void 0 : _a.type) === null || _b === void 0 ? void 0 : _b.mpType) !== null && _c !== void 0 ? _c : (_d = vm.type) === null || _d === void 0 ? void 0 : _d.mpType;
    if (vm.mpType === "page" || vm.$mpType === "page" || ((_e = vm.$mp) === null || _e === void 0 ? void 0 : _e.mpType) === "page" || ((_f = vm.$options) === null || _f === void 0 ? void 0 : _f.mpType) === "page" || internalMpType === "page") {
      return "page";
    }
    if (vm.mpType === "app" || vm.$mpType === "app" || ((_g = vm.$mp) === null || _g === void 0 ? void 0 : _g.mpType) === "app" || ((_h = vm.$options) === null || _h === void 0 ? void 0 : _h.mpType) === "app" || internalMpType === "app") {
      return "app";
    }
    return null;
  }
  function getTopPageVm() {
    var _a;
    const fn = getGlobalObject().getCurrentPages;
    if (typeof fn !== "function")
      return void 0;
    const pages = tryRun(() => fn(), []) || [];
    if (!Array.isArray(pages) || pages.length === 0)
      return void 0;
    const top = pages[pages.length - 1];
    return (_a = top === null || top === void 0 ? void 0 : top.$vm) !== null && _a !== void 0 ? _a : top;
  }
  function getCurrentRoute(pageVm) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l;
    const vm = pageVm !== null && pageVm !== void 0 ? pageVm : getTopPageVm();
    if (!vm)
      return "";
    if (getPlatform() === "bd") {
      const r = (_e = (_c = (_b = (_a = vm.$mp) === null || _a === void 0 ? void 0 : _a.page) === null || _b === void 0 ? void 0 : _b.is) !== null && _c !== void 0 ? _c : (_d = vm.$scope) === null || _d === void 0 ? void 0 : _d.is) !== null && _e !== void 0 ? _e : "";
      if (r)
        return r;
    }
    return (_l = (_h = (_f = vm.route) !== null && _f !== void 0 ? _f : (_g = vm.$scope) === null || _g === void 0 ? void 0 : _g.route) !== null && _h !== void 0 ? _h : (_k = (_j = vm.$mp) === null || _j === void 0 ? void 0 : _j.page) === null || _k === void 0 ? void 0 : _k.route) !== null && _l !== void 0 ? _l : "";
  }
  function getCurrentRouteWithQuery(pageVm) {
    var _a, _b;
    const vm = pageVm !== null && pageVm !== void 0 ? pageVm : getTopPageVm();
    if (!vm)
      return "";
    const page = (_a = vm.$page) !== null && _a !== void 0 ? _a : (_b = vm.$scope) === null || _b === void 0 ? void 0 : _b.$page;
    if (page) {
      if (page.fullPath && page.fullPath !== "/")
        return page.fullPath;
      if (page.route)
        return page.route;
    }
    return getCurrentRoute(vm);
  }
  function getUni$9() {
    const u = resolveUniRuntime();
    return u != null && typeof u === "object" ? u : void 0;
  }
  function getLaunchScene(override) {
    if (override !== void 0 && override !== null && override !== "") {
      return String(override);
    }
    const u = getUni$9();
    if (typeof (u === null || u === void 0 ? void 0 : u.getLaunchOptionsSync) !== "function")
      return "";
    if (!isMp())
      return "";
    return tryRun(() => {
      const opts = u.getLaunchOptionsSync();
      const scene = opts === null || opts === void 0 ? void 0 : opts.scene;
      return scene === void 0 || scene === null ? "" : String(scene);
    }, "");
  }
  function getUni$8() {
    const u = resolveUniRuntime();
    return u != null && typeof u === "object" ? u : void 0;
  }
  function getPushClientId(opts = {}) {
    const { enabled = false, timeoutMs = 3e3 } = opts;
    return new Promise((resolve) => {
      if (!enabled) {
        resolve({ ok: false, cid: "", reason: "disabled" });
        return;
      }
      const u = getUni$8();
      if (!u || typeof u.getPushClientId !== "function") {
        resolve({ ok: false, cid: "", reason: "unsupported" });
        return;
      }
      let settled = false;
      const finish = (r) => {
        if (settled)
          return;
        settled = true;
        resolve(r);
      };
      const timer = setTimeout(() => finish({ ok: false, cid: "", reason: "timeout" }), timeoutMs);
      tryRun(() => u.getPushClientId({
        success: (res) => {
          clearTimeout(timer);
          const cid = typeof (res === null || res === void 0 ? void 0 : res.cid) === "string" ? res.cid : "";
          if (!cid) {
            finish({ ok: false, cid: "", reason: "fail" });
            return;
          }
          finish({ ok: true, cid });
        },
        fail: () => {
          clearTimeout(timer);
          finish({ ok: false, cid: "", reason: "fail" });
        }
      }), void 0);
    });
  }
  const EMPTY_TITLE_SNAP = { ttn: "", ttpj: "", ttc: "" };
  const state$1 = {
    lastRoute: "",
    lastRouteFull: "",
    beforeLastRoute: "",
    beforeLastRouteFull: "",
    lastRouteEnterTime: 0,
    lastPageTitleSnap: Object.assign({}, EMPTY_TITLE_SNAP),
    lastIey: false,
    prevIey: false,
    isHide: false,
    wasBackgrounded: false,
    pendingBackgroundResume: false,
    backgroundEnteredAt: 0,
    suppressNextPageLogAfterResume: false,
    backgroundResumeLt1At: 0
  };
  const BACKGROUND_RESUME_DEBOUNCE_SEC = 1;
  const BACKGROUND_RESUME_LT1_DEDUP_SEC = 3;
  const PAGE_APP_HIDE_DEFER_MS = 120;
  let pageAppHideDeferTimer;
  function shouldEarlyConsumeBackgroundResumeInMixin() {
    return !shouldBindUniAppLifecycle();
  }
  function markBackgroundResumeLt1Emitted(now) {
    state$1.backgroundResumeLt1At = now;
  }
  function shouldSkipDuplicateBackgroundResumeLt1(now) {
    return state$1.backgroundResumeLt1At > 0 && now - state$1.backgroundResumeLt1At <= BACKGROUND_RESUME_LT1_DEDUP_SEC;
  }
  function cancelPageAppHideDefer() {
    if (pageAppHideDeferTimer !== void 0) {
      clearTimeout(pageAppHideDeferTimer);
      pageAppHideDeferTimer = void 0;
    }
  }
  function tryAppHideFromPageOnHideWhenH5Hidden(app, opts) {
    var _a;
    if (!isH5())
      return;
    if (state$1.pendingBackgroundResume)
      return;
    const vis = (_a = globalThis.document) === null || _a === void 0 ? void 0 : _a.visibilityState;
    if (vis === "hidden") {
      handleAppHide(app, opts);
    }
  }
  function tryAppHideFromPageOnHideWhenMpDefer(app, opts) {
    if (isH5())
      return;
    if (state$1.pendingBackgroundResume)
      return;
    cancelPageAppHideDefer();
    pageAppHideDeferTimer = setTimeout(() => {
      pageAppHideDeferTimer = void 0;
      if (state$1.pendingBackgroundResume)
        return;
      handleAppHide(app, opts);
    }, PAGE_APP_HIDE_DEFER_MS);
  }
  function tryVue3AppHideFromPageOnHide(app, opts) {
    if (state$1.pendingBackgroundResume)
      return;
    if (isH5()) {
      tryAppHideFromPageOnHideWhenH5Hidden(app, opts);
      return;
    }
    tryAppHideFromPageOnHideWhenMpDefer(app, opts);
  }
  function safeCollector(app) {
    return app.getCollector();
  }
  function normalizePathForEntryMark(raw) {
    var _a;
    if (!raw || typeof raw !== "string")
      return "";
    const noQuery = (_a = raw.split("?")[0]) !== null && _a !== void 0 ? _a : "";
    return noQuery.startsWith("/") ? noQuery.slice(1) : noQuery;
  }
  function reportNewSession(c, _cst, scene, now, attachVisit, url = "") {
    let visit;
    if (attachVisit && !firstVisitEmittedInProcess) {
      firstVisitEmittedInProcess = true;
      visit = tryRun(() => buildVisitFields(now), void 0);
    } else {
      visit = tryRun(() => buildVisitFieldsForSessionRenewal(now), void 0);
    }
    const payload = {
      lt: LT.Launch,
      t: now,
      sc: scene,
      visit
    };
    if (url)
      payload.url = url;
    c.report(payload);
  }
  let firstVisitEmittedInProcess = false;
  let titleSnapGeneration = 0;
  function scheduleDeferredTitleSnapshot() {
    const gen = titleSnapGeneration;
    const run = typeof queueMicrotask === "function" ? queueMicrotask : (fn) => {
      void Promise.resolve().then(fn);
    };
    run(() => {
      tryRun(() => {
        if (gen !== titleSnapGeneration)
          return;
        state$1.lastPageTitleSnap = Object.assign({}, getCurrentTitle());
      }, void 0);
    });
  }
  function handleLaunch(app, options = {}, opts = {}) {
    const c = safeCollector(app);
    if (!c)
      return;
    const now = nowSec();
    const scene = tryRun(() => getLaunchScene(options.scene), "");
    const result = tryRun(() => ensureSession("cold_launch", { now, scene }), null);
    if (!result)
      return;
    tryRun(() => clearEntry(), void 0);
    const url = options.path || "";
    const entryKey = normalizePathForEntryMark(url);
    if (entryKey) {
      tryRun(() => markEntryPage(entryKey), void 0);
    }
    reportNewSession(c, result.cst || CST.ColdLaunch, scene, now, true, url);
    if (opts.enablePush) {
      void getPushClientId({ enabled: true, timeoutMs: opts.pushTimeoutMs }).then((r) => {
        if (!r.ok || !r.cid)
          return;
        const c2 = safeCollector(app);
        if (!c2)
          return;
        c2.report({ lt: LT.Push, cid: r.cid, t: nowSec() });
      }).catch((e) => logger.warn("[uni统计 2.0] push cid fetch failed", e));
    }
  }
  function tryConsumeBackgroundResume(app, options = {}, _opts = {}, _from = "unknown") {
    if (!state$1.pendingBackgroundResume) {
      return false;
    }
    const bgEnterAt = state$1.backgroundEnteredAt;
    if (bgEnterAt <= 0) {
      return false;
    }
    const c = safeCollector(app);
    if (!c) {
      return false;
    }
    const now = nowSec();
    const elapsed = now - bgEnterAt;
    if (elapsed < BACKGROUND_RESUME_DEBOUNCE_SEC) {
      state$1.suppressNextPageLogAfterResume = true;
      return true;
    }
    state$1.wasBackgrounded = false;
    state$1.suppressNextPageLogAfterResume = true;
    state$1.lastRouteEnterTime = now;
    const scene = tryRun(() => getLaunchScene(options.scene), "");
    const result = tryRun(() => ensureSession("app_show", {
      now,
      scene,
      backgroundEnteredAt: bgEnterAt
    }), null);
    state$1.pendingBackgroundResume = false;
    state$1.backgroundEnteredAt = 0;
    if (!result || !result.isNew) {
      return true;
    }
    tryRun(() => clearEntry(), void 0);
    const url = options.path || state$1.lastRoute || "";
    const entryKey = normalizePathForEntryMark(url);
    if (entryKey) {
      tryRun(() => markEntryPage(entryKey), void 0);
    }
    reportNewSession(c, result.cst || CST.BackgroundTimeout, scene, now, false, url);
    markBackgroundResumeLt1Emitted(now);
    void c.flush(true).catch((e) => logger.warn("[uni统计 2.0] flush after new session (app_show) failed", e));
    return true;
  }
  function handleAppShow(app, options = {}, opts = {}) {
    if (tryConsumeBackgroundResume(app, options, opts, "handleAppShow"))
      return;
    const c = safeCollector(app);
    if (!c)
      return;
    const now = nowSec();
    const scene = tryRun(() => getLaunchScene(options.scene), "");
    if (shouldSkipDuplicateBackgroundResumeLt1(now)) {
      tryRun(() => syncLastScene(scene), void 0);
      return;
    }
    const result = tryRun(() => ensureSession("app_show", { now, scene }), null);
    if (!result || !result.isNew) {
      return;
    }
    tryRun(() => clearEntry(), void 0);
    const url = options.path || state$1.lastRoute || "";
    const entryKey = normalizePathForEntryMark(url);
    if (entryKey) {
      tryRun(() => markEntryPage(entryKey), void 0);
    }
    reportNewSession(c, result.cst || CST.BackgroundTimeout, scene, now, false, url);
    markBackgroundResumeLt1Emitted(now);
    void c.flush(true).catch((e) => logger.warn("[uni统计 2.0] flush after new session (app_show) failed", e));
  }
  function handleAppHide(app, opts = {}) {
    if (state$1.pendingBackgroundResume)
      return;
    const c = safeCollector(app);
    if (!c)
      return;
    const now = nowSec();
    state$1.wasBackgrounded = true;
    state$1.pendingBackgroundResume = true;
    state$1.backgroundEnteredAt = now;
    tryRun(() => markBackground(now), void 0);
    const deltaStay = state$1.lastRouteEnterTime > 0 ? now - state$1.lastRouteEnterTime : 0;
    const stayed = clampUrlrefStaySec(deltaStay);
    if (state$1.lastRoute && opts.enablePageLog !== false) {
      const exitedUrl = state$1.lastRouteFull || state$1.lastRoute;
      const ref = state$1.beforeLastRouteFull || state$1.beforeLastRoute || "";
      const snap = state$1.lastPageTitleSnap;
      const payload = {
        lt: LT.Page,
        t: now,
        url: exitedUrl,
        urlref_ts: stayed,
        iey: state$1.lastIey,
        ppiey: state$1.prevIey,
        ttn: snap.ttn,
        ttpj: snap.ttpj,
        ttc: snap.ttc
      };
      if (ref)
        payload.urlref = ref;
      c.report(payload);
      if (state$1.lastIey) {
        tryRun(() => markEntryDeparted(), void 0);
        state$1.lastIey = false;
      }
    }
    c.report({
      lt: LT.Hide,
      t: now,
      urlref: state$1.lastRoute,
      urlref_ts: stayed
    });
    void c.flush(true).catch((e) => logger.warn("[uni统计 2.0] flush on hide failed", e));
  }
  function handlePageShow(app, vm, opts = {}) {
    const c = safeCollector(app);
    if (!c)
      return;
    if (state$1.pendingBackgroundResume && shouldEarlyConsumeBackgroundResumeInMixin()) {
      tryConsumeBackgroundResume(app, {}, opts, "handlePageShow");
    }
    const now = nowSec();
    const route = tryRun(() => getCurrentRoute(vm), "");
    const url = tryRun(() => getCurrentRouteWithQuery(vm), "") || route;
    if (!route && !url)
      return;
    const result = tryRun(() => ensureSession("page_show", { now }), null);
    if (!result)
      return;
    tryRun(() => setReportTitle(""), void 0);
    tryRun(() => setConfigTitle(getPagesJsonNavigationTitle(route)), void 0);
    if (result.isNew) {
      tryRun(() => clearEntry(), void 0);
    }
    if (route) {
      tryRun(() => markEntryPage(route), void 0);
    }
    if (result.isNew) {
      reportNewSession(c, result.cst || CST.PageInactiveTimeout, "", now, false, url);
    }
    const shouldSuppressPageLog = state$1.suppressNextPageLogAfterResume;
    if (state$1.lastRoute && opts.enablePageLog !== false && !shouldSuppressPageLog) {
      const deltaStay = state$1.lastRouteEnterTime > 0 ? now - state$1.lastRouteEnterTime : 0;
      const stayed = clampUrlrefStaySec(deltaStay);
      const exitedUrl = state$1.lastRouteFull || state$1.lastRoute;
      const ref = state$1.beforeLastRouteFull || state$1.beforeLastRoute || "";
      const snap = state$1.lastPageTitleSnap;
      const payload = {
        lt: LT.Page,
        t: now,
        url: exitedUrl,
        urlref_ts: stayed,
        // 离开页是否入口页 / urlref 指向页是否入口页（进入新页前状态尚未被本轮覆盖）。
        iey: state$1.lastIey,
        ppiey: state$1.prevIey
      };
      if (ref)
        payload.urlref = ref;
      payload.ttn = snap.ttn;
      payload.ttpj = snap.ttpj;
      payload.ttc = snap.ttc;
      c.report(payload);
      if (state$1.lastIey) {
        tryRun(() => markEntryDeparted(), void 0);
      }
    }
    state$1.beforeLastRoute = state$1.lastRoute;
    state$1.beforeLastRouteFull = state$1.lastRouteFull;
    state$1.prevIey = state$1.lastIey;
    state$1.lastIey = !!route && tryRun(() => isEntryForIey(route), false);
    state$1.lastRoute = route;
    state$1.lastRouteFull = url;
    state$1.lastRouteEnterTime = now;
    state$1.suppressNextPageLogAfterResume = false;
    scheduleDeferredTitleSnapshot();
    state$1.isHide = false;
    if (result.isNew) {
      void c.flush(true).catch((e) => logger.warn("[uni统计 2.0] flush after new session (page_show) failed", e));
    }
  }
  function handlePageHide(app, _vm) {
    const c = safeCollector(app);
    if (!c)
      return;
    state$1.isHide = true;
    titleSnapGeneration++;
    state$1.lastPageTitleSnap = Object.assign({}, getCurrentTitle());
    tryRun(() => clearPageTitle(), void 0);
  }
  const rethrownErrors = typeof WeakSet === "function" ? /* @__PURE__ */ new WeakSet() : (
    // 极端环境降级：has=false 永不命中，add=noop；本模块只用 has/add 两个方法，
    // 其它方法（delete / [Symbol.toStringTag]）调用方不依赖，类型断言即可。
    {
      has: () => false,
      add: () => rethrownErrors
    }
  );
  function handleError(app, e) {
    const isObj = typeof e === "object" && e !== null;
    if (isObj && rethrownErrors.has(e))
      return;
    if (isObj)
      rethrownErrors.add(e);
    try {
      app.reportError(e);
    } catch (err) {
      logger.warn("[uni统计 2.0] handleError failed", err);
    }
    if (isMp()) {
      return;
    }
    tryRun(() => {
      setTimeout(() => {
        throw e;
      }, 0);
    }, void 0);
  }
  function getUni$7() {
    const u = resolveUniRuntime();
    return u != null && typeof u === "object" ? u : void 0;
  }
  function shouldMixinDispatchAppLifecycle() {
    let result = isH5() || getPlatform() === "n" || isNvue();
    result = isH5() || getPlatform() === "n" || isNvue();
    return result;
  }
  function shouldBindUniAppLifecycle() {
    let result = !isH5() && getPlatform() !== "n" && !isNvue();
    result = !isH5() && getPlatform() !== "n" && !isNvue();
    return result;
  }
  const uniAppHookRegistry = {
    showBound: false,
    hideBound: false,
    appShowCb: void 0,
    appHideCb: void 0
  };
  function tryBindUniAppLifecycle(app, opts = {}) {
    if (!shouldBindUniAppLifecycle())
      return false;
    const u = getUni$7();
    if (!u)
      return false;
    if (!uniAppHookRegistry.showBound && typeof u.onAppShow === "function") {
      uniAppHookRegistry.appShowCb = (e) => handleAppShow(app, e !== null && e !== void 0 ? e : {}, opts);
      tryRun(() => u.onAppShow(uniAppHookRegistry.appShowCb), void 0);
      uniAppHookRegistry.showBound = true;
    }
    if (!uniAppHookRegistry.hideBound && typeof u.onAppHide === "function") {
      uniAppHookRegistry.appHideCb = () => handleAppHide(app, opts);
      tryRun(() => u.onAppHide(uniAppHookRegistry.appHideCb), void 0);
      uniAppHookRegistry.hideBound = true;
    }
    return uniAppHookRegistry.showBound && uniAppHookRegistry.hideBound;
  }
  function unbindUniAppLifecycle() {
    if (!uniAppHookRegistry.showBound && !uniAppHookRegistry.hideBound)
      return;
    const cur = getUni$7();
    if (uniAppHookRegistry.showBound && uniAppHookRegistry.appShowCb && (cur === null || cur === void 0 ? void 0 : cur.offAppShow)) {
      tryRun(() => cur.offAppShow(uniAppHookRegistry.appShowCb), void 0);
    }
    if (uniAppHookRegistry.hideBound && uniAppHookRegistry.appHideCb && (cur === null || cur === void 0 ? void 0 : cur.offAppHide)) {
      tryRun(() => cur.offAppHide(uniAppHookRegistry.appHideCb), void 0);
    }
    uniAppHookRegistry.showBound = false;
    uniAppHookRegistry.hideBound = false;
    uniAppHookRegistry.appShowCb = void 0;
    uniAppHookRegistry.appHideCb = void 0;
  }
  function bindLifecycle(app, opts = {}) {
    let bound = true;
    const mixin = {
      onLaunch(options = {}) {
        handleLaunch(app, options, opts);
      },
      onLoad() {
      },
      onShow() {
        const vmType = getPageVmType(this);
        cancelPageAppHideDefer();
        if (state$1.pendingBackgroundResume && shouldEarlyConsumeBackgroundResumeInMixin()) {
          tryConsumeBackgroundResume(app, {}, opts, "mixin.onShow");
        }
        state$1.isHide = false;
        if (vmType === "page") {
          handlePageShow(app, this, opts);
        }
        if (shouldMixinDispatchAppLifecycle() && vmType === "app") {
          handleAppShow(app, {}, opts);
        }
      },
      onHide() {
        state$1.isHide = true;
        if (getPageVmType(this) === "page") {
          handlePageHide(app);
          tryVue3AppHideFromPageOnHide(app, opts);
        }
        if (shouldMixinDispatchAppLifecycle() && getPageVmType(this) === "app" && !state$1.pendingBackgroundResume) {
          handleAppHide(app, opts);
        }
      },
      onUnload() {
        if (state$1.isHide) {
          state$1.isHide = false;
          return;
        }
        handlePageHide(app);
      },
      onError(e) {
        handleError(app, e);
      }
    };
    if (shouldBindUniAppLifecycle()) {
      tryBindUniAppLifecycle(app, opts);
    }
    return {
      mixin,
      tryBindUniAppHooks: () => shouldBindUniAppLifecycle() && tryBindUniAppLifecycle(app, opts),
      unbind() {
        if (!bound)
          return;
        bound = false;
        unbindUniAppLifecycle();
      }
    };
  }
  const STAT_VERSION_PUBLIC = "5.24";
  const STAT_URL = "https://tongji.dcloud.io/uni/stat";
  const STAT_H5_URL = "https://tongji.dcloud.io/uni/stat.gif";
  const REPORT_INTERVAL_SEC = 10;
  const HTTP_MAX_RETRIES = 3;
  const CLOUD_MAX_RETRIES = 2;
  const IMAGE_MAX_RETRIES = 2;
  const RETRY_BASE_DELAY_MS = 1e3;
  const MP_WEIXIN_USE_PRELOAD_ASSETS_REPORT = true;
  const MP_WEIXIN_PRELOAD_TIMEOUT_MS = 3e4;
  const MP_WEIXIN_PRELOAD_FIRST_FLUSH_DELAY_MS = 2e3;
  const APP_CHANNEL_FIRST_FLUSH_DELAY_MS = 300;
  const SINGLE_EVENT_MAX_BYTES = 4 * 1024;
  const BATCH_REQUESTS_MAX_BYTES = 4 * 1024;
  const BATCH_MAX_EVENTS = 30;
  const QUEUE_MAX_EVENTS = 1e3;
  const RETRY_MAX_ATTEMPTS = 5;
  const IMAGE_REPORT_DEFAULTS = {
    host: "https://tongji-collector.dcloud.net.cn",
    /** 正式环境 */
    projectId: "964f0397-af5d-45bf-99d6-8fb3500d7849",
    topicId: "8563e231-f4cd-4ab0-8870-917e4b04e810"
    // 以下为历史测试环境（已停用，勿删便于回切排查）
    // projectId: '9fad19a2-b7f1-47f5-87ff-8621f545ab61',
    // topicId: '99b55c91-ed80-406e-b205-e9d18aca744d',
  };
  function getAppId$1() {
    var _a;
    return (_a = "__UNI__DAB5E07") !== null && _a !== void 0 ? _a : "";
  }
  function assertCloudResultOk(res) {
    if (!res || typeof res !== "object")
      return;
    const r = res;
    if (r.success === false) {
      throw new Error("cloud receiver reported success=false");
    }
    if (typeof r.errCode === "number" && r.errCode !== 0) {
      throw new Error("cloud receiver reported errCode=" + String(r.errCode));
    }
  }
  function resolveSpace(injected) {
    if (injected)
      return injected;
    const raw = resolveUniRuntime();
    const u = raw != null && typeof raw === "object" ? raw : void 0;
    return u === null || u === void 0 ? void 0 : u.__stat_uniCloud_space;
  }
  function createCloudChannel(opts = {}) {
    var _a, _b;
    const receiverName = (_a = opts.receiverName) !== null && _a !== void 0 ? _a : "uni-stat-receiver";
    const maxRetries = (_b = opts.maxRetries) !== null && _b !== void 0 ? _b : CLOUD_MAX_RETRIES;
    function getReceiver() {
      const space = resolveSpace(opts.uniCloudSpace);
      if (!space || typeof space.importObject !== "function")
        return void 0;
      try {
        return space.importObject(receiverName, { customUI: true });
      } catch (e) {
        logger.warn("[uni统计 2.0] cloud importObject threw", e);
        return void 0;
      }
    }
    function once(payload) {
      const receiver = getReceiver();
      if (!receiver || typeof receiver.report !== "function") {
        return Promise.reject(new Error("uniCloud space unavailable"));
      }
      return Promise.resolve(receiver.report(payload)).then((res) => {
        assertCloudResultOk(res);
      });
    }
    return {
      name: "2.0",
      available() {
        const space = resolveSpace(opts.uniCloudSpace);
        return !!(space && typeof space.importObject === "function");
      },
      send(payload) {
        return __awaiter(this, void 0, void 0, function* () {
          try {
            yield withRetry(() => once(payload), {
              times: maxRetries,
              baseDelayMs: RETRY_BASE_DELAY_MS,
              sleep: opts.sleep
            });
          } catch (e) {
            logger.warn("[uni统计 2.0] 统计上报失败（云函数已重试）", e);
            throw e;
          }
        });
      }
    };
  }
  function getActionLabel(lt) {
    switch (lt) {
      case LT.Launch:
        return "应用启动";
      case LT.Hide:
        return "应用进入后台";
      case LT.Page:
        return "页面切换";
      case LT.Event:
        return "事件触发";
      case LT.Error:
        return "应用错误";
      case LT.Push:
        return "PUSH 设备标识";
      default:
        return `未知事件 (lt=${String(lt !== null && lt !== void 0 ? lt : "?")})`;
    }
  }
  function bucketSize(bucket) {
    let n2 = 0;
    for (const lt of Object.keys(bucket)) {
      const arr = bucket[lt];
      if (Array.isArray(arr))
        n2 += arr.length;
    }
    return n2;
  }
  function bucketSummary(bucket) {
    const parts = [];
    for (const lt of Object.keys(bucket)) {
      const arr = bucket[lt];
      if (Array.isArray(arr) && arr.length > 0) {
        parts.push(`lt=${lt}×${arr.length}`);
      }
    }
    return parts.join(", ") || "<空>";
  }
  function logCollect(data) {
    if (!logger.isDebug())
      return;
    const lt = data.lt;
    const label = getActionLabel(lt);
    logger.debug(`=== 统计数据采集：${label} (lt=${String(lt !== null && lt !== void 0 ? lt : "?")}) ===`);
    logger.debug(data);
    logger.debug("=== 采集结束 ===");
  }
  function logBoot(info) {
    if (!logger.isDebug())
      return;
    const timeoutParts = [];
    if (info.backgroundTimeoutSec != null) {
      timeoutParts.push(`后台超时(新会话): ${info.backgroundTimeoutSec}s`);
    }
    if (info.pageInactiveTimeoutSec != null) {
      timeoutParts.push(`前台无操作超时: ${info.pageInactiveTimeoutSec}s`);
    }
    const timeoutSeg = timeoutParts.length > 0 ? ` | ${timeoutParts.join(" | ")}` : "";
    const lines = [
      "=== uni统计 2.0 已启用 ===",
      `上报间隔: ${info.reportIntervalSec}s${timeoutSeg} | 应用APPID: ${info.ak || "<未注入>"}${info.appName ? ` | 应用名: ${info.appName}` : ""}${info.vueMode ? ` | ${info.vueMode}` : ""}`
    ];
    if (info.debugFromManifest) {
      lines.push("调试模式：已从 manifest.uniStatistics.debug 自动开启");
    }
    lines.push("=== 后续将在每次采集 / 上报时输出过程日志 ===");
    logger.debug(lines.join("\n"));
  }
  function logReportStart(info) {
    if (!logger.isDebug())
      return;
    const total = bucketSize(info.bucket);
    const summary = bucketSummary(info.bucket);
    logger.debug(`=== 准备上报：共 ${total} 条事件 (${summary}) ===`);
  }
  function logReportFailureReason(info) {
    if (!logger.isDebug())
      return;
    logger.debug(`原因: ${describeError(info.error)}`);
    if (info.persistedId) {
      logger.debug(`已暂存重试队列 [retryId=${info.persistedId}]，下次启动自动续传`);
    } else {
      logger.debug("未能写入重试队列：本批数据已丢弃");
    }
  }
  function logReportSummary(info) {
    if (!logger.isDebug())
      return;
    if (info.failedCount === 0) {
      logger.debug(`=== 上报成功： ${info.okCount} 条事件已送达, 用时 ${info.elapsedMs}ms ===`);
    } else if (info.okCount === 0) {
      logger.debug(`=== 上报失败： ${info.failedCount} 条事件未送达, 用时 ${info.elapsedMs}ms ===`);
    } else {
      logger.debug(`=== 上报完成：成功 ${info.okCount} 条，失败 ${info.failedCount} 条，用时 ${info.elapsedMs}ms ===`);
    }
  }
  function logNoChannel(info) {
    if (!logger.isDebug())
      return;
    logger.debug(`=== 上报跳过：当前无可用通道，已回滚 ${bucketSize(info.bucket)} 条事件入队 ===`);
  }
  function logRecoverStart(count) {
    if (!logger.isDebug())
      return;
    logger.debug(`=== 冷启续传：发现 ${count} 条历史 payload，开始逐条重发 ===`);
  }
  function logRecoverItem(info) {
    if (!logger.isDebug())
      return;
    if (info.ok) {
      logger.debug(`续传成功 (${info.index}/${info.total})`);
    } else {
      logger.debug(`续传失败 (${info.index}/${info.total})：${describeError(info.error)}`);
    }
  }
  function describeError(e) {
    if (!e)
      return "<无错误对象>";
    if (e instanceof Error) {
      return `${e.name}: ${e.message}`;
    }
    if (typeof e === "string")
      return e;
    return safeStringify(e) || String(e);
  }
  function omitEmptyStringFieldsForUpload(data) {
    const out = {};
    for (const key of Object.keys(data)) {
      const v = data[key];
      if (v === "")
        continue;
      out[key] = v;
    }
    return out;
  }
  const LT_ORDER = {
    "1": 1,
    "11": 2,
    "21": 3,
    "31": 4,
    "101": 5,
    "3": 100
  };
  const UNKNOWN_LT_WEIGHT = 50;
  function handleData(buckets) {
    return JSON.stringify(flatten(buckets));
  }
  function flatten(buckets) {
    const ltKeys = Object.keys(buckets);
    ltKeys.sort((a, b) => weightOf(a) - weightOf(b));
    const out = [];
    for (let i = 0; i < ltKeys.length; i++) {
      const lt = ltKeys[i];
      const list = buckets[lt];
      if (!list || list.length === 0)
        continue;
      for (let j = 0; j < list.length; j++)
        out.push(list[j]);
    }
    return out;
  }
  function weightOf(lt) {
    const w = LT_ORDER[lt];
    return typeof w === "number" ? w : UNKNOWN_LT_WEIGHT;
  }
  function chunkEvents(events, opts = {}) {
    var _a, _b;
    const maxEvents2 = (_a = opts.maxEvents) !== null && _a !== void 0 ? _a : Infinity;
    const maxBytes = (_b = opts.maxBytes) !== null && _b !== void 0 ? _b : Infinity;
    const out = [];
    if (!Array.isArray(events) || events.length === 0)
      return out;
    const safeMaxEvents = maxEvents2 > 0 ? maxEvents2 : Infinity;
    const safeMaxBytes = maxBytes > 0 ? maxBytes : Infinity;
    let cur = [];
    let curBytes = 2;
    for (let i = 0; i < events.length; i++) {
      const e = events[i];
      let s2 = "";
      try {
        s2 = JSON.stringify(e);
      } catch (_c) {
        continue;
      }
      const inc = cur.length === 0 ? s2.length : s2.length + 1;
      const wouldExceed = cur.length >= safeMaxEvents || cur.length > 0 && curBytes + inc > safeMaxBytes;
      if (wouldExceed) {
        out.push(cur);
        cur = [];
        curBytes = 2;
      }
      cur.push(e);
      curBytes += cur.length === 1 ? s2.length : s2.length + 1;
    }
    if (cur.length > 0)
      out.push(cur);
    return out;
  }
  function handleDataChunked(buckets, opts = {}) {
    const events = flatten(buckets);
    if (events.length === 0)
      return [];
    const chunks = chunkEvents(events, opts);
    const out = [];
    for (let i = 0; i < chunks.length; i++) {
      out.push(JSON.stringify(chunks[i]));
    }
    return out;
  }
  class PermanentChannelError extends Error {
    constructor(message) {
      super(message);
      this.permanent = true;
      this.name = "PermanentChannelError";
      Object.setPrototypeOf(this, PermanentChannelError.prototype);
    }
  }
  function isPermanentChannelError(err) {
    if (!err || typeof err !== "object")
      return false;
    if (err instanceof PermanentChannelError)
      return true;
    const e = err;
    if (e.name === "PermanentChannelError")
      return true;
    if (e.permanent === true)
      return true;
    return false;
  }
  function defaultGenPayloadId(nowMs2) {
    return "p-" + nowMs2.toString(36) + "-" + Math.random().toString(36).slice(2, 6);
  }
  function createCollector(deps) {
    let firstFlushDone = false;
    let deferredFlushTimer = null;
    function cancelDeferredFlush() {
      if (deferredFlushTimer == null)
        return;
      clearTimeout(deferredFlushTimer);
      deferredFlushTimer = null;
    }
    function triggerAutoFlush() {
      var _a;
      const deferMs = Math.max(0, Math.floor((_a = deps.firstFlushDeferMs) !== null && _a !== void 0 ? _a : 0));
      if (!firstFlushDone && deferMs > 0) {
        if (deferredFlushTimer != null)
          return;
        deferredFlushTimer = setTimeout(() => {
          deferredFlushTimer = null;
          firstFlushDone = true;
          void flushImpl(false).catch((e) => logger.warn("[uni统计 2.0] auto-flush failed", e));
        }, deferMs);
        return;
      }
      firstFlushDone = true;
      void flushImpl(false).catch((e) => logger.warn("[uni统计 2.0] auto-flush failed", e));
    }
    function report(input) {
      tryRun(() => {
        const t = typeof input.t === "number" ? input.t : deps.nowSec();
        const snap = deps.session.getSnapshot();
        let sessionForCtx;
        if (snap) {
          const seq = deps.session.nextSeq();
          sessionForCtx = Object.assign({}, snap, { seq });
        }
        if (snap && input.lt === LT.Event && deps.session.touch) {
          deps.session.touch(t);
        }
        const ctx = Object.assign({}, input, {
          t,
          session: sessionForCtx
        });
        const data = deps.builder.build(ctx);
        logCollect(data);
        deps.queue.enqueue(omitEmptyStringFieldsForUpload(data));
        if (deps.queue.shouldFlush()) {
          triggerAutoFlush();
        }
      }, void 0);
    }
    function applyUploadFields(bucket) {
      const fields = deps.resolveUploadFields ? deps.resolveUploadFields() : {};
      const keys = Object.keys(fields).filter((key) => {
        const v = fields[key];
        return v !== "" && v !== void 0 && v !== null;
      });
      if (keys.length === 0)
        return;
      for (const lt of Object.keys(bucket)) {
        const list = bucket[lt];
        if (!Array.isArray(list))
          continue;
        for (let i = 0; i < list.length; i++) {
          const item = list[i];
          for (let j = 0; j < keys.length; j++) {
            const key = keys[j];
            item[key] = fields[key];
          }
        }
      }
    }
    function applyUploadFieldsToRequests(requests) {
      const fields = deps.resolveUploadFields ? deps.resolveUploadFields() : {};
      const keys = Object.keys(fields).filter((key) => {
        const v = fields[key];
        return v !== "" && v !== void 0 && v !== null;
      });
      if (keys.length === 0)
        return requests;
      try {
        const events = JSON.parse(requests);
        if (!Array.isArray(events))
          return requests;
        for (let i = 0; i < events.length; i++) {
          const item = events[i];
          if (!item || typeof item !== "object")
            continue;
          for (let j = 0; j < keys.length; j++) {
            const key = keys[j];
            item[key] = fields[key];
          }
        }
        return JSON.stringify(events);
      } catch (_a) {
        return requests;
      }
    }
    function applyUploadFieldsToPayload(payload) {
      const requests = applyUploadFieldsToRequests(payload.requests);
      if (requests === payload.requests)
        return payload;
      return Object.assign({}, payload, { requests });
    }
    function flushImpl() {
      return __awaiter(this, arguments, void 0, function* (force = false) {
        var _a, _b, _c, _d, _e;
        if (!deps.queue.shouldFlush(force))
          return;
        if (deps.isNetworkOffline) {
          let offline = false;
          try {
            offline = yield deps.isNetworkOffline();
          } catch (_f) {
            offline = false;
          }
          if (offline) {
            logger.warn("[uni统计 2.0] 当前无网络，延后 flush");
            return;
          }
        }
        const snapshot = deps.queue.flush();
        if (!snapshot)
          return;
        applyUploadFields(snapshot);
        const channel = deps.selectChannel();
        if (!channel) {
          logger.warn("[uni统计 2.0] 无可用上报线路，本批已回滚队列");
          logNoChannel({ bucket: snapshot });
          deps.queue.rollback(snapshot);
          return;
        }
        const globalMaxBytes = (_b = (_a = deps.batchLimits) === null || _a === void 0 ? void 0 : _a.maxBytes) !== null && _b !== void 0 ? _b : BATCH_REQUESTS_MAX_BYTES;
        const channelMaxBytes = typeof channel.maxRequestBytes === "function" ? channel.maxRequestBytes() : Number.POSITIVE_INFINITY;
        const limits = {
          maxEvents: (_d = (_c = deps.batchLimits) === null || _c === void 0 ? void 0 : _c.maxEvents) !== null && _d !== void 0 ? _d : BATCH_MAX_EVENTS,
          maxBytes: Math.min(globalMaxBytes, channelMaxBytes)
        };
        const chunks = handleDataChunked(snapshot, limits);
        if (chunks.length === 0) {
          logger.warn("[uni统计 2.0] flush 切片结果为空，已回滚队列", snapshot);
          deps.queue.rollback(snapshot);
          return;
        }
        const startMs = deps.nowMs();
        let totalCount = 0;
        for (const lt of Object.keys(snapshot)) {
          const arr = snapshot[lt];
          if (Array.isArray(arr))
            totalCount += arr.length;
        }
        logReportStart({ channel: channel.name, bucket: snapshot });
        const hasLaunch = Array.isArray(snapshot["1"]) && snapshot["1"].length > 0;
        let okEvents = 0;
        let failedEvents = 0;
        let allOk = true;
        let firstChunkOk = true;
        for (let i = 0; i < chunks.length; i++) {
          const requests = chunks[i];
          const payload = {
            usv: deps.config.usv,
            t: deps.nowSec(),
            requests,
            _id: ((_e = deps.genPayloadId) !== null && _e !== void 0 ? _e : () => defaultGenPayloadId(deps.nowMs()))()
          };
          const sliceEvents = countEvents(requests);
          try {
            yield channel.send(payload);
            okEvents += sliceEvents;
          } catch (e) {
            allOk = false;
            if (i === 0)
              firstChunkOk = false;
            failedEvents += sliceEvents;
            if (isPermanentChannelError(e)) {
              logger.warn("[uni统计 2.0] 统计上报失败（本批已丢弃，不可重试）", e, "sliceBytes=" + requests.length);
              logReportFailureReason({ error: e, persistedId: void 0 });
              continue;
            }
            logger.warn("[uni统计 2.0] 统计上报失败（已暂存，下次启动自动重试）", e);
            const id = deps.retry.persist(payload);
            if (!id) {
              logger.warn("[uni统计 2.0] 统计暂存重试失败（无 retryId），本批已丢弃");
            }
            logReportFailureReason({ error: e, persistedId: id });
          }
        }
        const visitAccepted = hasLaunch ? firstChunkOk : allOk;
        if (visitAccepted) {
          tryRun(() => deps.visit.commitVisitOnAck(deps.nowSec()), void 0);
        } else {
          tryRun(() => deps.visit.rollbackPendingVisit(), void 0);
        }
        logReportSummary({
          channel: channel.name,
          okCount: okEvents,
          failedCount: failedEvents,
          elapsedMs: deps.nowMs() - startMs
        });
      });
    }
    function countEvents(requests) {
      try {
        const arr = JSON.parse(requests);
        return Array.isArray(arr) ? arr.length : 0;
      } catch (_a) {
        return 0;
      }
    }
    function recoverRetry() {
      return __awaiter(this, void 0, void 0, function* () {
        if (deps.isNetworkOffline) {
          let offline = false;
          try {
            offline = yield deps.isNetworkOffline();
          } catch (_a) {
            offline = false;
          }
          if (offline) {
            logger.warn("[uni统计 2.0] 当前无网络，延后续传重试");
            return;
          }
        }
        const items = deps.retry.loadAll();
        if (items.length === 0)
          return;
        const channel = deps.selectChannel();
        if (!channel) {
          logger.warn("[uni统计 2.0] 续传重试跳过：当前无可用上报线路");
          return;
        }
        logRecoverStart(items.length);
        let i = 0;
        for (const payload of items) {
          i++;
          const uploadPayload = applyUploadFieldsToPayload(payload);
          try {
            yield channel.send(uploadPayload);
            if (payload._id)
              deps.retry.ack(payload._id);
            logRecoverItem({
              index: i,
              total: items.length,
              payloadId: payload._id,
              ok: true
            });
          } catch (e) {
            if (isPermanentChannelError(e)) {
              if (payload._id)
                deps.retry.ack(payload._id);
              logger.warn("[uni统计 2.0] 续传重试失败（不可重试，已从队列移除）", e, "id=" + payload._id);
              logRecoverItem({
                index: i,
                total: items.length,
                payloadId: payload._id,
                ok: false,
                error: e
              });
              continue;
            }
            if (payload._id && deps.retry.markAttempt) {
              deps.retry.markAttempt(payload._id);
            }
            logger.warn("[uni统计 2.0] 续传重试失败（保留队列，下次启动再试）", e);
            logRecoverItem({
              index: i,
              total: items.length,
              payloadId: payload._id,
              ok: false,
              error: e
            });
          }
        }
      });
    }
    function flush2() {
      return __awaiter(this, arguments, void 0, function* (force = false) {
        cancelDeferredFlush();
        firstFlushDone = true;
        return flushImpl(force);
      });
    }
    function destroy() {
      cancelDeferredFlush();
      firstFlushDone = true;
    }
    return { report, flush: flush2, recoverRetry, destroy };
  }
  function getUni$6() {
    const u = resolveUniRuntime();
    return u != null && typeof u === "object" ? u : void 0;
  }
  function toQuery(payload) {
    const out = [];
    out.push("usv=" + encodeURIComponent(String(payload.usv)));
    out.push("t=" + encodeURIComponent(String(payload.t)));
    out.push("requests=" + encodeURIComponent(payload.requests));
    return out.join("&");
  }
  function tryImageRequest(payload, h5Url = STAT_H5_URL) {
    const ImageCtor = getGlobalObject().Image;
    if (typeof ImageCtor !== "function")
      return false;
    return tryRun(() => {
      const img = new ImageCtor();
      img.src = h5Url + "?" + toQuery(payload);
      return true;
    }, false);
  }
  function createHttpChannel(opts = {}) {
    var _a, _b, _c, _d, _e;
    const url = (_a = opts.url) !== null && _a !== void 0 ? _a : STAT_URL;
    const h5Url = (_b = opts.h5Url) !== null && _b !== void 0 ? _b : STAT_H5_URL;
    const ut = (_c = opts.ut) !== null && _c !== void 0 ? _c : "";
    const timeoutMs = (_d = opts.timeoutMs) !== null && _d !== void 0 ? _d : 1e4;
    const maxRetries = (_e = opts.maxRetries) !== null && _e !== void 0 ? _e : HTTP_MAX_RETRIES;
    function once(payload) {
      if (ut === "h5" && opts.preferImageOnH5 !== false) {
        if (tryImageRequest(payload, h5Url))
          return Promise.resolve();
      }
      const u = getUni$6();
      if (!u || typeof u.request !== "function") {
        return Promise.reject(new Error("uni.request unavailable"));
      }
      return new Promise((resolve, reject) => {
        let settled = false;
        const timer = setTimeout(() => {
          if (settled)
            return;
          settled = true;
          reject(new Error("http timeout"));
        }, timeoutMs);
        u.request({
          url,
          method: "POST",
          data: payload,
          timeout: timeoutMs,
          success: (res) => {
            var _a2;
            if (settled)
              return;
            settled = true;
            clearTimeout(timer);
            const code = (_a2 = res === null || res === void 0 ? void 0 : res.statusCode) !== null && _a2 !== void 0 ? _a2 : 0;
            if (code >= 200 && code < 300)
              resolve();
            else
              reject(new Error("http status " + code));
          },
          fail: (e) => {
            if (settled)
              return;
            settled = true;
            clearTimeout(timer);
            reject(e instanceof Error ? e : new Error(String(e)));
          }
        });
      });
    }
    return {
      name: "1.0",
      available() {
        const u = getUni$6();
        return !!(u && typeof u.request === "function");
      },
      send(payload) {
        return __awaiter(this, void 0, void 0, function* () {
          try {
            yield withRetry(() => once(payload), {
              times: maxRetries,
              baseDelayMs: RETRY_BASE_DELAY_MS,
              sleep: opts.sleep
            });
          } catch (e) {
            logger.warn("[uni统计 2.0] 统计上报失败（HTTP 已重试）", e);
            throw e;
          }
        });
      }
    };
  }
  const WEBTRACK_API_PATH = "/WebTrack";
  const WEBTRACK_BEACON_PATH = "/WebTrack.gif";
  function getUni$5() {
    const u = resolveUniRuntime();
    return u != null && typeof u === "object" ? u : void 0;
  }
  const REPORT_URL_BASE_OVERHEAD = 256;
  const REPORT_ENCODE_RATIO = 3;
  function buildStatReportUrl(payload, opts) {
    var _a;
    const t = ((_a = opts.nowMs) !== null && _a !== void 0 ? _a : () => Date.now())();
    const logs = encodeURIComponent(payload.requests);
    const host = opts.host.replace(/\/+$/, "");
    return host + opts.path + "?ProjectId=" + encodeURIComponent(opts.projectId) + "&TopicId=" + encodeURIComponent(opts.topicId) + "&Logs=" + logs + "&Source=webImg&Time=" + t;
  }
  function summarizeHttpErrorBody(data, maxLen = 320) {
    if (data == null)
      return "";
    if (typeof data === "string") {
      return data.length <= maxLen ? data : data.slice(0, maxLen) + "…";
    }
    try {
      const s2 = JSON.stringify(data);
      return s2.length <= maxLen ? s2 : s2.slice(0, maxLen) + "…";
    } catch (_a) {
      return String(data).slice(0, maxLen);
    }
  }
  function imageBeaconAwait(url, ms) {
    const ImageCtor = getGlobalObject().Image;
    if (typeof ImageCtor !== "function") {
      return Promise.reject(new PermanentChannelError("当前环境无法完成统计上报"));
    }
    return new Promise((resolve, reject) => {
      let settled = false;
      const timer = setTimeout(() => {
        if (settled)
          return;
        settled = true;
        reject(new Error("统计上报超时"));
      }, ms);
      const img = new ImageCtor();
      img.onload = () => {
        if (settled)
          return;
        settled = true;
        clearTimeout(timer);
        resolve();
      };
      img.onerror = () => {
        if (settled)
          return;
        settled = true;
        clearTimeout(timer);
        resolve();
      };
      img.src = url;
    });
  }
  function fetchBeaconAwait(url, ms) {
    const g = getGlobalObject();
    const fetchFn = g.fetch;
    if (typeof fetchFn !== "function") {
      return Promise.reject(new Error("fetch unavailable"));
    }
    const controller = typeof g.AbortController === "function" ? new g.AbortController() : void 0;
    return new Promise((resolve, reject) => {
      let settled = false;
      const timer = setTimeout(() => {
        if (settled)
          return;
        settled = true;
        if (controller)
          tryRun(() => controller.abort(), void 0);
        reject(new Error("统计上报超时"));
      }, ms);
      fetchFn(url, {
        method: "GET",
        keepalive: true,
        credentials: "omit",
        signal: controller ? controller.signal : void 0
      }).then((res) => {
        if (settled)
          return;
        settled = true;
        clearTimeout(timer);
        if (res && res.ok) {
          resolve();
          return;
        }
        reject(new Error("统计上报 HTTP " + (res ? res.status : 0)));
      }, (e) => {
        if (settled)
          return;
        settled = true;
        clearTimeout(timer);
        reject(e instanceof Error ? e : new Error(String(e)));
      });
    });
  }
  function getWxPreloadAssets() {
    const wx = getGlobalObject().wx;
    return typeof (wx === null || wx === void 0 ? void 0 : wx.preloadAssets) === "function" ? wx.preloadAssets : void 0;
  }
  function formatWxPreloadFail(err) {
    if (err instanceof Error)
      return err;
    if (err != null && typeof err === "object" && "errMsg" in err) {
      const msg = err.errMsg;
      if (typeof msg === "string" && msg.length > 0)
        return new Error(msg);
    }
    if (err == null)
      return new Error("preloadAssets fail (empty err)");
    return new Error(String(err));
  }
  function mpWeixinPreloadAssetsBeaconAwait(url, ms, preload) {
    return new Promise((resolve, reject) => {
      let settled = false;
      const timer = setTimeout(() => {
        if (settled)
          return;
        settled = true;
        reject(new Error("统计上报超时(preloadAssets)"));
      }, ms);
      try {
        preload({
          data: [{ type: "image", src: url }],
          success: () => {
            if (settled)
              return;
            settled = true;
            clearTimeout(timer);
            resolve();
          },
          fail: (err) => {
            if (settled)
              return;
            settled = true;
            clearTimeout(timer);
            reject(formatWxPreloadFail(err));
          }
        });
      } catch (e) {
        if (settled)
          return;
        settled = true;
        clearTimeout(timer);
        reject(e instanceof Error ? e : new Error(String(e)));
      }
    });
  }
  function isMpWeixinPreloadEnabled(opts) {
    var _a, _b;
    const enabled = (_a = opts.mpWeixinPreloadReport) !== null && _a !== void 0 ? _a : MP_WEIXIN_USE_PRELOAD_ASSETS_REPORT;
    if (!enabled)
      return false;
    const raw = (_b = opts.rawPlatform) !== null && _b !== void 0 ? _b : getRawPlatform();
    return raw === "mp-weixin";
  }
  function createImageChannel(opts = {}) {
    var _a, _b, _c, _d, _e, _f, _g;
    const host = (_a = opts.host) !== null && _a !== void 0 ? _a : IMAGE_REPORT_DEFAULTS.host;
    const projectId = (_b = opts.projectId) !== null && _b !== void 0 ? _b : IMAGE_REPORT_DEFAULTS.projectId;
    const topicId = (_c = opts.topicId) !== null && _c !== void 0 ? _c : IMAGE_REPORT_DEFAULTS.topicId;
    const timeoutMs = (_d = opts.timeoutMs) !== null && _d !== void 0 ? _d : 1e4;
    const maxRetries = (_e = opts.maxRetries) !== null && _e !== void 0 ? _e : IMAGE_MAX_RETRIES;
    const maxUrlLength = (_f = opts.maxUrlLength) !== null && _f !== void 0 ? _f : 6 * 1024;
    const preferBeacon = opts.preferImageBeacon !== false;
    const nowMs2 = opts.nowMs;
    const ut = (_g = opts.ut) !== null && _g !== void 0 ? _g : "";
    const isH52 = ut === "h5";
    const mpWeixinPreload = isMpWeixinPreloadEnabled(opts);
    function configured() {
      return !!(host && projectId && topicId);
    }
    const reportOpts = { host, projectId, topicId, nowMs: nowMs2 };
    function preflightUrl(payload, path) {
      if (!configured()) {
        throw new PermanentChannelError("统计上报未配置：请设置 TLS host、projectId、topicId");
      }
      const url = buildStatReportUrl(payload, {
        host: reportOpts.host,
        projectId: reportOpts.projectId,
        topicId: reportOpts.topicId,
        nowMs: reportOpts.nowMs,
        path
      });
      if (url.length > maxUrlLength) {
        throw new PermanentChannelError("统计上报 URL 过长: " + url.length + " > " + maxUrlLength);
      }
      return url;
    }
    function webTrackGetViaRequest(url) {
      const u = getUni$5();
      if (!u || typeof u.request !== "function") {
        return Promise.reject(new PermanentChannelError("当前环境无法完成统计上报"));
      }
      return new Promise((resolve, reject) => {
        let settled = false;
        const timer = setTimeout(() => {
          if (settled)
            return;
          settled = true;
          reject(new Error("统计上报超时"));
        }, timeoutMs);
        u.request({
          url,
          method: "GET",
          timeout: timeoutMs,
          success: (res) => {
            var _a2;
            if (settled)
              return;
            settled = true;
            clearTimeout(timer);
            const code = (_a2 = res === null || res === void 0 ? void 0 : res.statusCode) !== null && _a2 !== void 0 ? _a2 : 0;
            if (code >= 200 && code < 300) {
              resolve();
              return;
            }
            const hint = summarizeHttpErrorBody(res === null || res === void 0 ? void 0 : res.data);
            reject(new Error(hint ? `统计上报 HTTP ${code}: ${hint}` : `统计上报 HTTP ${code}`));
          },
          fail: (e) => {
            if (settled)
              return;
            settled = true;
            clearTimeout(timer);
            reject(e instanceof Error ? e : new Error(String(e)));
          }
        });
      });
    }
    function onceH5(payload) {
      const g = getGlobalObject();
      const u = getUni$5();
      const hasRequest = !!(u && typeof u.request === "function");
      if (preferBeacon && typeof g.fetch === "function") {
        return fetchBeaconAwait(preflightUrl(payload, WEBTRACK_BEACON_PATH), timeoutMs);
      }
      if (hasRequest) {
        return webTrackGetViaRequest(preflightUrl(payload, WEBTRACK_API_PATH));
      }
      if (preferBeacon && typeof g.Image === "function") {
        return imageBeaconAwait(preflightUrl(payload, WEBTRACK_BEACON_PATH), timeoutMs);
      }
      return Promise.reject(new PermanentChannelError("当前环境无法完成统计上报"));
    }
    function onceMpWeixin(payload) {
      const preloadFn = getWxPreloadAssets();
      if (preloadFn) {
        return mpWeixinPreloadAssetsBeaconAwait(preflightUrl(payload, WEBTRACK_BEACON_PATH), MP_WEIXIN_PRELOAD_TIMEOUT_MS, preloadFn);
      }
      logger.warn("[uni统计 2.0] wx.preloadAssets 不可用，回退 uni.request GET /WebTrack");
      return webTrackGetViaRequest(preflightUrl(payload, WEBTRACK_API_PATH));
    }
    function dispatchReport(payload) {
      if (isH52)
        return onceH5(payload);
      if (mpWeixinPreload)
        return onceMpWeixin(payload);
      return webTrackGetViaRequest(preflightUrl(payload, WEBTRACK_API_PATH));
    }
    return {
      name: "image",
      available() {
        return configured();
      },
      maxRequestBytes() {
        const raw = (maxUrlLength - REPORT_URL_BASE_OVERHEAD) / REPORT_ENCODE_RATIO;
        return Math.max(512, Math.floor(raw));
      },
      send(payload) {
        return __awaiter(this, void 0, void 0, function* () {
          try {
            yield withRetry(() => dispatchReport(payload), {
              times: maxRetries,
              baseDelayMs: RETRY_BASE_DELAY_MS,
              sleep: opts.sleep
            });
          } catch (e) {
            if (isPermanentChannelError(e)) {
              logger.warn("[uni统计 2.0] 统计上报失败（不可重试）", e);
            } else {
              logger.warn("[uni统计 2.0] 统计上报失败（已重试）", e);
            }
            throw e;
          }
        });
      }
    };
  }
  function s(v, def = "") {
    if (typeof v === "string")
      return v;
    if (typeof v === "number" && Number.isFinite(v))
      return String(v);
    return def;
  }
  function n(v, def = 0) {
    if (typeof v === "number" && Number.isFinite(v))
      return v;
    if (typeof v === "string" && v.length > 0) {
      const x = Number(v);
      if (Number.isFinite(x))
        return x;
    }
    return def;
  }
  function createStatDataBuilder(deps) {
    function baseFields() {
      var _a, _b, _c;
      const { config: config2, platform, system, locale, device, net, location, pkg, legacy, web } = deps;
      return {
        ak: s(config2.ak),
        usv: s(config2.usv),
        v: s((_a = config2.v) !== null && _a !== void 0 ? _a : system.appVersion),
        ch: s(config2.ch),
        ut: s(platform.ut),
        p: s((_b = platform.p) !== null && _b !== void 0 ? _b : system.osP),
        on: s(system.on),
        did: s(device.uuid),
        brand: s(system.brand),
        md: s(system.md),
        sv: s(system.sv),
        mpsdk: s(system.sdkVersion),
        mpv: s(system.mpvHostVersion),
        pr: n(locale.pr, 1),
        ww: n(locale.ww),
        wh: n(locale.wh),
        sw: n(locale.sw),
        sh: n(locale.sh),
        lang: s(locale.lang),
        net: s(net.net, "unknown"),
        lat: s(location.lat),
        lng: s(location.lng),
        mpn: s((_c = legacy === null || legacy === void 0 ? void 0 : legacy.mpn) !== null && _c !== void 0 ? _c : pkg.mpn),
        tdaid: s(pkg.tdaid),
        pkn: s(pkg.pkn),
        an: s(pkg.an),
        domain: s(web.domain)
      };
    }
    function sessionFields(ctx) {
      if (!ctx.session)
        return {};
      return {
        sid: ctx.session.sid,
        cst: ctx.session.sct
      };
    }
    function pageFields(ctx) {
      const out = {};
      if (ctx.url !== void 0)
        out.url = s(ctx.url);
      if (ctx.urlref !== void 0)
        out.urlref = s(ctx.urlref);
      if (ctx.urlref_ts !== void 0)
        out.urlref_ts = n(ctx.urlref_ts);
      if (ctx.ttn !== void 0)
        out.ttn = s(ctx.ttn);
      if (ctx.ttpj !== void 0)
        out.ttpj = s(ctx.ttpj);
      if (ctx.ttc !== void 0)
        out.ttc = s(ctx.ttc);
      return out;
    }
    function entryFields(ctx) {
      if (ctx.lt === "11") {
        return {
          iey: toIey(ctx.iey !== void 0 ? ctx.iey : false),
          ppiey: toIey(ctx.ppiey !== void 0 ? ctx.ppiey : false)
        };
      }
      return {};
    }
    function visitFields(ctx) {
      if (ctx.lt !== "1")
        return {};
      if (!ctx.visit)
        return {};
      return {
        fvts: ctx.visit.fvts,
        lvts: ctx.visit.lvts,
        tvc: ctx.visit.tvc
      };
    }
    function launchFields(ctx) {
      if (ctx.lt !== "1")
        return {};
      if (ctx.sc === void 0)
        return {};
      return { sc: s(ctx.sc) };
    }
    function errorFields(ctx) {
      if (ctx.lt !== "31" || !ctx.errMsg)
        return {};
      const ERR_MSG_MAX = 3 * 1024;
      const TRUNC_SUFFIX = "…[truncated]";
      let em = s(ctx.errMsg);
      if (em.length > ERR_MSG_MAX) {
        em = em.slice(0, ERR_MSG_MAX - TRUNC_SUFFIX.length) + TRUNC_SUFFIX;
      }
      return { em };
    }
    function pushFields(ctx) {
      if (ctx.lt !== "101" || !ctx.cid)
        return {};
      return { cid: s(ctx.cid) };
    }
    function build(ctx) {
      const safeCustom = {};
      if (ctx.custom) {
        const reserved = /* @__PURE__ */ new Set([
          "lt",
          "t",
          "sid",
          "cst",
          "did",
          "p",
          "on",
          "mpv",
          "domain",
          "fvts",
          "lvts",
          "tvc",
          "sc"
        ]);
        for (const k of Object.keys(ctx.custom)) {
          if (!reserved.has(k))
            safeCustom[k] = ctx.custom[k];
        }
      }
      const out = { lt: ctx.lt, t: n(ctx.t) };
      Object.assign(out, baseFields(), sessionFields(ctx), pageFields(ctx), entryFields(ctx), visitFields(ctx), launchFields(ctx), errorFields(ctx), pushFields(ctx), safeCustom);
      return out;
    }
    return { build };
  }
  function normalizeChannelValue(value) {
    if (typeof value === "string")
      return value;
    if (typeof value === "number" && Number.isFinite(value))
      return String(value);
    return "";
  }
  function getAppChannel() {
    const plus2 = getGlobalObject().plus;
    if (!isApp() && !(plus2 === null || plus2 === void 0 ? void 0 : plus2.runtime))
      return "";
    const raw = tryRun(() => {
      var _a;
      return (_a = plus2 === null || plus2 === void 0 ? void 0 : plus2.runtime) === null || _a === void 0 ? void 0 : _a.channel;
    }, void 0);
    return normalizeChannelValue(raw);
  }
  let cachedStatic = null;
  function getUni$4() {
    const u = resolveUniRuntime();
    return u != null && typeof u === "object" ? u : void 0;
  }
  function mergeWxHostSnapshots() {
    const raw = getRawPlatform();
    if (raw !== "mp-weixin" && raw !== "mp-qq")
      return null;
    const wxHost = getGlobalObject().wx;
    if (!wxHost)
      return null;
    const sync = typeof wxHost.getSystemInfoSync === "function" ? tryRun(() => wxHost.getSystemInfoSync(), null) : null;
    const device = typeof wxHost.getDeviceInfo === "function" ? tryRun(() => wxHost.getDeviceInfo(), null) : null;
    const appBase = typeof wxHost.getAppBaseInfo === "function" ? tryRun(() => wxHost.getAppBaseInfo(), null) : null;
    const windowInfo = typeof wxHost.getWindowInfo === "function" ? tryRun(() => wxHost.getWindowInfo(), null) : null;
    return mergeSystemSnapshots(sync, device, appBase, windowInfo);
  }
  function mergeSystemSnapshots(...parts) {
    const out = {};
    for (const p of parts) {
      if (!p)
        continue;
      for (const k of Object.keys(p)) {
        const v = p[k];
        if (v !== void 0 && v !== null)
          out[k] = v;
      }
    }
    return out;
  }
  function mergedSystemInfo() {
    const u = getUni$4();
    const sync = u && typeof u.getSystemInfoSync === "function" ? tryRun(() => u.getSystemInfoSync(), null) : null;
    const device = u && typeof u.getDeviceInfo === "function" ? tryRun(() => u.getDeviceInfo(), null) : null;
    const appBase = u && typeof u.getAppBaseInfo === "function" ? tryRun(() => u.getAppBaseInfo(), null) : null;
    const windowInfo = u && typeof u.getWindowInfo === "function" ? tryRun(() => u.getWindowInfo(), null) : null;
    const fromUni = mergeSystemSnapshots(sync, device, appBase, windowInfo);
    const fromWx = mergeWxHostSnapshots();
    const merged = fromWx ? mergeSystemSnapshots(fromUni, fromWx) : fromUni;
    return merged;
  }
  function resolveUniConfigAppVersion() {
    return tryRun(() => {
      const cfg = getGlobalObject().__uniConfig;
      return typeof (cfg === null || cfg === void 0 ? void 0 : cfg.appVersion) === "string" ? cfg.appVersion : "";
    }, "");
  }
  function resolveBuildTimeAppVersion() {
    const raw = "0.1.0";
    return typeof raw === "string" ? raw : "";
  }
  function resolveAppVersionForStat(plus2, sys) {
    var _a;
    const fromPlus = (_a = plus2 === null || plus2 === void 0 ? void 0 : plus2.runtime) === null || _a === void 0 ? void 0 : _a.version;
    if (typeof fromPlus === "string" && fromPlus)
      return fromPlus;
    const fromSys = sys.appVersion;
    if (typeof fromSys === "string" && fromSys)
      return fromSys;
    const fromUniConfig = resolveUniConfigAppVersion();
    if (fromUniConfig)
      return fromUniConfig;
    return resolveBuildTimeAppVersion();
  }
  function buildOnForStat(sys) {
    const rom = typeof sys.romName === "string" ? sys.romName.trim() : "";
    if (rom) {
      const romVer = typeof sys.romVersion === "string" ? sys.romVersion.trim() : "";
      return romVer ? `${rom} ${romVer}`.trim() : rom;
    }
    return typeof sys.osName === "string" ? sys.osName.trim() : "";
  }
  function getSystemInfo() {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s, _t;
    if (cachedStatic)
      return cachedStatic;
    const sys = mergedSystemInfo();
    const plus2 = getGlobalObject().plus;
    const appVersion = resolveAppVersionForStat(plus2, sys);
    cachedStatic = {
      brand: (_b = (_a = sys.deviceBrand) !== null && _a !== void 0 ? _a : sys.brand) !== null && _b !== void 0 ? _b : "",
      md: (_d = (_c = sys.deviceModel) !== null && _c !== void 0 ? _c : sys.model) !== null && _d !== void 0 ? _d : "",
      sv: (_f = (_e = sys.osVersion) !== null && _e !== void 0 ? _e : sys.system) !== null && _f !== void 0 ? _f : "",
      v: (_h = (_g = sys.hostVersion) !== null && _g !== void 0 ? _g : sys.version) !== null && _h !== void 0 ? _h : "",
      ut: (_j = sys.deviceType) !== null && _j !== void 0 ? _j : "unknown",
      appVersion,
      appWgtVersion: (_p = (_o = (_l = (_k = plus2 === null || plus2 === void 0 ? void 0 : plus2.runtime) === null || _k === void 0 ? void 0 : _k.appWgtVersion) !== null && _l !== void 0 ? _l : (_m = plus2 === null || plus2 === void 0 ? void 0 : plus2.runtime) === null || _m === void 0 ? void 0 : _m.appWgtRevision) !== null && _o !== void 0 ? _o : sys.appWgtVersion) !== null && _p !== void 0 ? _p : "",
      mpvHostVersion: ((_r = (_q = sys.hostVersion) !== null && _q !== void 0 ? _q : sys.version) !== null && _r !== void 0 ? _r : "").trim(),
      on: buildOnForStat(sys),
      sdkVersion: (_t = (_s = sys.hostSDKVersion) !== null && _s !== void 0 ? _s : sys.SDKVersion) !== null && _t !== void 0 ? _t : "",
      statusBarHeight: typeof sys.statusBarHeight === "number" ? sys.statusBarHeight : 0,
      osP: normalizeStatOsP({
        platform: sys.platform,
        osName: sys.osName,
        system: sys.system
      })
    };
    return cachedStatic;
  }
  function getLocaleAndScreen() {
    var _a, _b;
    const sys = mergedSystemInfo();
    const prRaw = typeof sys.pixelRatio === "number" ? sys.pixelRatio : typeof sys.devicePixelRatio === "number" ? sys.devicePixelRatio : 1;
    return {
      lang: ((_b = (_a = sys.hostLanguage) !== null && _a !== void 0 ? _a : sys.language) !== null && _b !== void 0 ? _b : "").replace(/_/g, "-"),
      ww: typeof sys.windowWidth === "number" ? sys.windowWidth : 0,
      wh: typeof sys.windowHeight === "number" ? sys.windowHeight : 0,
      sw: typeof sys.screenWidth === "number" ? sys.screenWidth : 0,
      sh: typeof sys.screenHeight === "number" ? sys.screenHeight : 0,
      pr: prRaw > 0 ? prRaw : 1
    };
  }
  let cached$1 = null;
  function getUni$3() {
    const u = resolveUniRuntime();
    return u != null && typeof u === "object" ? u : void 0;
  }
  function getPlus() {
    return getGlobalObject().plus;
  }
  function getMpTdaid(platform) {
    const u = getUni$3();
    switch (platform) {
      case "wx":
      case "qq": {
        if (typeof (u === null || u === void 0 ? void 0 : u.getAccountInfoSync) === "function") {
          const id = tryRun(() => {
            var _a, _b;
            return (_b = (_a = u.getAccountInfoSync().miniProgram) === null || _a === void 0 ? void 0 : _a.appId) !== null && _b !== void 0 ? _b : "";
          }, "");
          if (id)
            return id;
        }
        const wxHost = getGlobalObject().wx;
        if (typeof (wxHost === null || wxHost === void 0 ? void 0 : wxHost.getAccountInfoSync) === "function") {
          const id2 = tryRun(() => {
            var _a, _b;
            return (_b = (_a = wxHost.getAccountInfoSync().miniProgram) === null || _a === void 0 ? void 0 : _a.appId) !== null && _b !== void 0 ? _b : "";
          }, "");
          if (id2)
            return id2;
        }
        const envId = "__UNI__DAB5E07";
        return typeof envId === "string" ? envId : "";
      }
      case "ali":
      case "dt": {
        const my = getGlobalObject().my;
        if (!my)
          return "";
        const v1 = tryRun(() => {
          var _a, _b;
          return (_b = (_a = my.getAppIdSync) === null || _a === void 0 ? void 0 : _a.call(my)) !== null && _b !== void 0 ? _b : "";
        }, "");
        if (v1)
          return v1;
        return tryRun(() => {
          var _a, _b, _c;
          return (_c = (_b = (_a = my.getAccountInfoSync) === null || _a === void 0 ? void 0 : _a.call(my).miniProgram) === null || _b === void 0 ? void 0 : _b.appId) !== null && _c !== void 0 ? _c : "";
        }, "");
      }
      case "tt":
      case "lark": {
        const tt = getGlobalObject().tt;
        return tryRun(() => {
          var _a, _b, _c;
          return (_c = (_b = (_a = tt === null || tt === void 0 ? void 0 : tt.getEnvInfoSync) === null || _a === void 0 ? void 0 : _a.call(tt).microapp) === null || _b === void 0 ? void 0 : _b.appId) !== null && _c !== void 0 ? _c : "";
        }, "");
      }
      case "bd": {
        const swan = getGlobalObject().swan;
        return tryRun(() => {
          var _a, _b, _c;
          return (_c = (_b = (_a = swan === null || swan === void 0 ? void 0 : swan.getEnvInfoSync) === null || _a === void 0 ? void 0 : _a.call(swan).common) === null || _b === void 0 ? void 0 : _b.appKey) !== null && _c !== void 0 ? _c : "";
        }, "");
      }
      default:
        return "";
    }
  }
  function getAppPkn() {
    var _a, _b, _c;
    const plus2 = getPlus();
    if (!plus2)
      return "";
    const osName = (_c = (_b = (_a = plus2.os) === null || _a === void 0 ? void 0 : _a.name) === null || _b === void 0 ? void 0 : _b.toLowerCase()) !== null && _c !== void 0 ? _c : "";
    if (osName.includes("android")) {
      return tryRun(() => {
        var _a2, _b2, _c2, _d, _e;
        return (_e = (_d = (_c2 = (_b2 = (_a2 = plus2.android) === null || _a2 === void 0 ? void 0 : _a2.runtimeMainActivity) === null || _b2 === void 0 ? void 0 : _b2.call(_a2)) === null || _c2 === void 0 ? void 0 : _c2.getPackageName) === null || _d === void 0 ? void 0 : _d.call(_c2)) !== null && _e !== void 0 ? _e : "";
      }, "");
    }
    if (osName === "ios" || osName === "iphone os") {
      const v = tryRun(() => {
        var _a2, _b2;
        return (_b2 = (_a2 = plus2.ios) === null || _a2 === void 0 ? void 0 : _a2.bundleId) !== null && _b2 !== void 0 ? _b2 : "";
      }, "");
      return v || tryRun(() => {
        var _a2, _b2;
        return (_b2 = (_a2 = plus2.runtime) === null || _a2 === void 0 ? void 0 : _a2.appid) !== null && _b2 !== void 0 ? _b2 : "";
      }, "");
    }
    return tryRun(() => {
      var _a2, _b2;
      return (_b2 = (_a2 = plus2.runtime) === null || _a2 === void 0 ? void 0 : _a2.appid) !== null && _b2 !== void 0 ? _b2 : "";
    }, "");
  }
  function getAppName() {
    const plus2 = getPlus();
    if (!plus2)
      return "";
    return tryRun(() => {
      var _a, _b;
      return (_b = (_a = plus2.runtime) === null || _a === void 0 ? void 0 : _a.appname) !== null && _b !== void 0 ? _b : "";
    }, "") || tryRun(() => {
      var _a, _b;
      return (_b = (_a = plus2.runtime) === null || _a === void 0 ? void 0 : _a.name) !== null && _b !== void 0 ? _b : "";
    }, "");
  }
  function getEnvAppName() {
    var _a;
    return (_a = "美记账") !== null && _a !== void 0 ? _a : "";
  }
  function getH5AppName() {
    const env = getEnvAppName();
    if (env)
      return env;
    return tryRun(() => {
      var _a, _b;
      return (_b = (_a = getGlobalObject().document) === null || _a === void 0 ? void 0 : _a.title) !== null && _b !== void 0 ? _b : "";
    }, "");
  }
  function getPackageInfo() {
    if (cached$1)
      return cached$1;
    const platform = getPlatform();
    let mpn = "";
    let tdaid = "";
    let pkn = "";
    let an = "";
    if (isApp()) {
      tdaid = tryRun(() => {
        var _a, _b, _c;
        return (_c = (_b = (_a = getPlus()) === null || _a === void 0 ? void 0 : _a.runtime) === null || _b === void 0 ? void 0 : _b.appid) !== null && _c !== void 0 ? _c : "";
      }, "");
      pkn = getAppPkn() || tdaid;
      an = getAppName() || getEnvAppName();
      mpn = pkn || tdaid;
    } else if (isMp()) {
      tdaid = getMpTdaid(platform);
      pkn = "";
      an = getEnvAppName();
      mpn = tdaid || "__UNI__DAB5E07";
    } else if (isH5()) {
      tdaid = "";
      pkn = "";
      an = getH5AppName();
      mpn = "";
    } else {
      tdaid = "";
      pkn = "";
      an = getEnvAppName();
      mpn = "";
    }
    cached$1 = { mpn, tdaid, pkn, an };
    return cached$1;
  }
  const EMPTY_WEB_INFO = { domain: "" };
  let cached = null;
  function readWebDomainFromLocation(loc) {
    const protocol = typeof loc.protocol === "string" ? loc.protocol.toLowerCase() : "";
    if (protocol !== "http:" && protocol !== "https:")
      return "";
    if (typeof loc.origin === "string" && loc.origin.trim()) {
      return loc.origin.trim();
    }
    const host = typeof loc.host === "string" && loc.host.trim() ? loc.host.trim() : typeof loc.hostname === "string" ? loc.hostname.trim() : "";
    if (!host)
      return "";
    return `${protocol}//${host}`;
  }
  function getWebInfo() {
    if (!isH5())
      return EMPTY_WEB_INFO;
    if (cached !== null)
      return cached;
    cached = tryRun(() => {
      const win = getGlobalObject();
      const loc = win.location;
      if (!loc)
        return EMPTY_WEB_INFO;
      return { domain: readWebDomainFromLocation(loc) };
    }, EMPTY_WEB_INFO);
    return cached;
  }
  const registry = /* @__PURE__ */ new Map();
  const installedFanout = /* @__PURE__ */ new Map();
  function add(api, handlers) {
    var _a;
    const set2 = (_a = registry.get(api)) !== null && _a !== void 0 ? _a : /* @__PURE__ */ new Set();
    set2.add(handlers);
    registry.set(api, set2);
    reinstall(api);
    return () => {
      const cur = registry.get(api);
      if (!cur)
        return;
      cur.delete(handlers);
      if (cur.size === 0) {
        registry.delete(api);
        const prev = installedFanout.get(api);
        installedFanout.delete(api);
        if (prev) {
          try {
            getUni$2().removeInterceptor(api, prev);
          } catch (_a2) {
          }
        }
      } else {
        reinstall(api);
      }
    };
  }
  function buildFanout(set2) {
    return {
      invoke(args) {
        let blocked = false;
        for (const h of set2) {
          if (!h.invoke)
            continue;
          const r = h.invoke(args);
          if (r === false)
            blocked = true;
        }
        return blocked ? false : void 0;
      },
      success(res) {
        var _a;
        for (const h of set2)
          (_a = h.success) === null || _a === void 0 ? void 0 : _a.call(h, res);
      },
      fail(err) {
        var _a;
        for (const h of set2)
          (_a = h.fail) === null || _a === void 0 ? void 0 : _a.call(h, err);
      },
      complete(res) {
        var _a;
        for (const h of set2)
          (_a = h.complete) === null || _a === void 0 ? void 0 : _a.call(h, res);
      },
      returnValue(res) {
        let v = res;
        for (const h of set2) {
          if (!h.returnValue)
            continue;
          v = h.returnValue(v);
        }
        return v;
      }
    };
  }
  function reinstall(api) {
    const set2 = registry.get(api);
    if (!set2 || set2.size === 0)
      return;
    const fanout = buildFanout(set2);
    try {
      const uni2 = getUni$2();
      const prev = installedFanout.get(api);
      if (prev) {
        try {
          uni2.removeInterceptor(api, prev);
        } catch (_a) {
        }
      }
      uni2.addInterceptor(api, fanout);
      installedFanout.set(api, fanout);
    } catch (_b) {
    }
  }
  function getUni$2() {
    const raw = resolveUniRuntime();
    const u = raw != null && typeof raw === "object" ? raw : void 0;
    if (!u)
      throw new Error("[uni统计 2.0] uni interceptor API is not available");
    return u;
  }
  function __reset() {
    registry.clear();
    installedFanout.clear();
  }
  const interceptor = { add, __reset };
  function registerLoginInterceptor(reporter) {
    return interceptor.add("login", {
      complete() {
        reporter.report({ lt: LT.Event, custom: { e_n: "login" } });
      }
    });
  }
  function registerNavigationBarInterceptor() {
    return interceptor.add("setNavigationBarTitle", {
      invoke(args) {
        const a = args;
        if (a && "title" in a)
          setPageTitle(a.title);
      }
    });
  }
  function registerPaymentInterceptor(reporter) {
    return interceptor.add("requestPayment", {
      success() {
        reporter.report({ lt: LT.Event, custom: { e_n: "pay_success" } });
      },
      fail() {
        reporter.report({ lt: LT.Event, custom: { e_n: "pay_fail" } });
      }
    });
  }
  function registerShareInterceptor(reporter) {
    const fire = () => reporter.report({ lt: LT.Event, custom: { e_n: "share" } });
    return interceptor.add("share", {
      success() {
        fire();
      },
      fail() {
        fire();
      }
    });
  }
  function installAllInterceptors(reporter) {
    const unbinders = [
      registerLoginInterceptor(reporter),
      registerShareInterceptor(reporter),
      registerPaymentInterceptor(reporter),
      registerNavigationBarInterceptor()
    ];
    return () => {
      for (const u of unbinders) {
        try {
          u();
        } catch (_a) {
        }
      }
    };
  }
  const KEY_DONE = "migration:done";
  const KEY_MAP = [
    ["__first__visit__time", "visit:fvts"],
    ["__last__visit__time", "visit:lvts"],
    ["__total__visit__count", "visit:tvc"]
  ];
  function getAppId() {
    const id = "__UNI__DAB5E07";
    if (id.length > 0)
      return id;
    return "default";
  }
  function readLegacyAggregate() {
    const u = resolveUniRuntime();
    if (!u || typeof u.getStorageSync !== "function")
      return null;
    const key = `${LEGACY_NAMESPACE_ROOT}:${getAppId()}`;
    const raw = tryRun(() => u.getStorageSync(key), null);
    if (raw && typeof raw === "object")
      return raw;
    return null;
  }
  let ran = false;
  function migrateLegacyData() {
    if (ran)
      return false;
    ran = true;
    const doneR = storage.safeRead(KEY_DONE);
    if (doneR.ok && doneR.value)
      return false;
    const legacy = readLegacyAggregate();
    if (!legacy) {
      storage.set(KEY_DONE, 1);
      return false;
    }
    let migrated = 0;
    for (let i = 0; i < KEY_MAP.length; i++) {
      const [oldKey, newKey] = KEY_MAP[i];
      if (!(oldKey in legacy))
        continue;
      const value = legacy[oldKey];
      const existing = storage.safeRead(newKey);
      if (existing.ok && existing.value !== void 0)
        continue;
      storage.set(newKey, value);
      migrated++;
    }
    storage.set(KEY_DONE, 1);
    if (migrated > 0) {
      logger.info("[uni统计 2.0] migrated legacy keys", migrated);
    }
    return migrated > 0;
  }
  function selectChannel(opts) {
    var _a;
    const version = (_a = opts.version) !== null && _a !== void 0 ? _a : "image";
    const fallback = opts.fallbackToHttp !== false;
    if (version === "1") {
      if (opts.http && opts.http.available())
        return opts.http;
      return void 0;
    }
    if (version === "2") {
      if (opts.cloud && opts.cloud.available())
        return opts.cloud;
      if (!fallback) {
        logger.warn("[uni统计 2.0] 云函数上报不可用且已关闭 HTTP 兜底，本批已丢弃");
        return void 0;
      }
      if (opts.http && opts.http.available()) {
        logger.warn("[uni统计 2.0] 云函数上报不可用，已降级为 HTTP 上报");
        return opts.http;
      }
      logger.warn("[uni统计 2.0] 无可用上报线路");
      return void 0;
    }
    if (opts.image && opts.image.available())
      return opts.image;
    if (!fallback) {
      if (opts.image) {
        logger.warn("[uni统计 2.0] 统计上报线路不可用且已关闭 HTTP 兜底，本批已丢弃");
      }
      return void 0;
    }
    if (opts.http && opts.http.available()) {
      if (opts.image) {
        logger.warn("[uni统计 2.0] 统计上报线路不可用，已降级为 HTTP 上报");
      }
      return opts.http;
    }
    logger.warn("[uni统计 2.0] 无可用上报线路");
    return void 0;
  }
  const DEFAULT_RESULT = { net: "unknown", raw: "" };
  const NET_MAP = {
    wifi: "wifi",
    "2g": "2g",
    "3g": "3g",
    "4g": "4g",
    "5g": "5g",
    ethernet: "ethernet",
    none: "none",
    unknown: "unknown"
  };
  function getUni$1() {
    const u = resolveUniRuntime();
    return u != null && typeof u === "object" ? u : void 0;
  }
  function normalizeNet(raw) {
    var _a;
    if (typeof raw !== "string" || raw.length === 0)
      return "unknown";
    return (_a = NET_MAP[raw.toLowerCase()]) !== null && _a !== void 0 ? _a : "unknown";
  }
  function getNet(timeoutMs = 1500) {
    return new Promise((resolve) => {
      const u = getUni$1();
      if (!u || typeof u.getNetworkType !== "function") {
        resolve(DEFAULT_RESULT);
        return;
      }
      let settled = false;
      const finish = (r) => {
        if (settled)
          return;
        settled = true;
        resolve(r);
      };
      const timer = setTimeout(() => finish(DEFAULT_RESULT), timeoutMs);
      tryRun(() => u.getNetworkType({
        success: (res) => {
          var _a;
          clearTimeout(timer);
          const raw = (_a = res === null || res === void 0 ? void 0 : res.networkType) !== null && _a !== void 0 ? _a : "";
          finish({ net: normalizeNet(raw), raw });
        },
        fail: () => {
          clearTimeout(timer);
          finish(DEFAULT_RESULT);
        }
      }), void 0);
    });
  }
  function onChange(cb) {
    const u = getUni$1();
    if (!u || typeof u.onNetworkStatusChange !== "function") {
      return () => {
      };
    }
    const wrapped = (res) => {
      var _a;
      const raw = (_a = res === null || res === void 0 ? void 0 : res.networkType) !== null && _a !== void 0 ? _a : "";
      const net = (res === null || res === void 0 ? void 0 : res.isConnected) === false ? "none" : normalizeNet(raw);
      tryRun(() => cb({ net, raw }), void 0);
    };
    tryRun(() => u.onNetworkStatusChange(wrapped), void 0);
    return () => {
      if (typeof u.offNetworkStatusChange === "function") {
        tryRun(() => u.offNetworkStatusChange(wrapped), void 0);
      }
    };
  }
  function isOfflineNetResult(r) {
    return r.net === "none";
  }
  function isNetworkOffline() {
    return __awaiter(this, void 0, void 0, function* () {
      const r = yield getNet();
      return isOfflineNetResult(r);
    });
  }
  function onNetworkOnline(cb) {
    return onChange((r) => {
      if (isOfflineNetResult(r))
        return;
      cb();
    });
  }
  const STORAGE_KEY$1 = "queue";
  const DEFAULT_SINGLE_EVENT_MAX_BYTES = SINGLE_EVENT_MAX_BYTES;
  const state = {
    bucket: {},
    lastFlushAt: 0
  };
  let intervalSec = REPORT_INTERVAL_SEC;
  let singleEventMaxBytes = DEFAULT_SINGLE_EVENT_MAX_BYTES;
  let maxEvents = QUEUE_MAX_EVENTS;
  let restored = false;
  let capacityWarned = false;
  function configure(opts) {
    if (typeof opts.intervalSec === "number" && opts.intervalSec >= 0) {
      intervalSec = Math.floor(opts.intervalSec);
    }
    if (typeof opts.singleEventMaxBytes === "number" && opts.singleEventMaxBytes > 0) {
      singleEventMaxBytes = Math.floor(opts.singleEventMaxBytes);
    }
    if (typeof opts.maxEvents === "number" && opts.maxEvents > 0) {
      maxEvents = Math.floor(opts.maxEvents);
    }
  }
  function enforceCapacity() {
    let total = size();
    if (total <= maxEvents) {
      capacityWarned = false;
      return;
    }
    const dropped = total - maxEvents;
    while (total > maxEvents) {
      let largestLt = "";
      let largestLen = 0;
      for (const lt of Object.keys(state.bucket)) {
        const len = state.bucket[lt].length;
        if (len > largestLen) {
          largestLen = len;
          largestLt = lt;
        }
      }
      if (!largestLt || largestLen === 0)
        break;
      state.bucket[largestLt].shift();
      if (state.bucket[largestLt].length === 0)
        delete state.bucket[largestLt];
      total--;
    }
    if (!capacityWarned) {
      capacityWarned = true;
      logger.warn("[uni统计 2.0] 上报队列超过容量上限，已丢弃最旧事件", "dropped=" + dropped, "limit=" + maxEvents);
    }
  }
  function persistBucket() {
    if (Object.keys(state.bucket).length === 0) {
      storage.remove(STORAGE_KEY$1);
      return;
    }
    try {
      storage.set(STORAGE_KEY$1, state.bucket);
    } catch (e) {
      logger.warn("[uni统计 2.0] queue persist failed", e);
    }
  }
  function restoreOnce() {
    if (restored)
      return;
    restored = true;
    const raw = storage.safeRead(STORAGE_KEY$1);
    if (!raw.ok || !raw.value || typeof raw.value !== "object")
      return;
    const persisted = raw.value;
    for (const lt of Object.keys(persisted)) {
      const arr = persisted[lt];
      if (!Array.isArray(arr) || arr.length === 0)
        continue;
      if (!state.bucket[lt])
        state.bucket[lt] = [];
      state.bucket[lt].push(...arr);
    }
  }
  function enqueue(data) {
    var _a;
    if (!data || typeof data !== "object")
      return;
    const lt = String((_a = data.lt) !== null && _a !== void 0 ? _a : "");
    if (!lt) {
      logger.warn("[uni统计 2.0] enqueue dropped: missing lt", data);
      return;
    }
    let serialized = "";
    try {
      serialized = JSON.stringify(data);
    } catch (e) {
      logger.warn("[uni统计 2.0] enqueue dropped: stringify failed", e);
      return;
    }
    if (serialized.length > singleEventMaxBytes) {
      logger.warn("[uni统计 2.0] enqueue dropped: single event too large", "lt=" + lt, "bytes=" + serialized.length, "limit=" + singleEventMaxBytes);
      return;
    }
    restoreOnce();
    if (!state.bucket[lt])
      state.bucket[lt] = [];
    state.bucket[lt].push(data);
    enforceCapacity();
    persistBucket();
  }
  function shouldFlush(force = false) {
    if (force)
      return true;
    if (intervalSec <= 0)
      return true;
    const elapsedSec = (nowMs() - state.lastFlushAt) / 1e3;
    return elapsedSec >= intervalSec;
  }
  function flush() {
    restoreOnce();
    const lts = Object.keys(state.bucket);
    if (lts.length === 0)
      return void 0;
    const snapshot = state.bucket;
    state.bucket = {};
    state.lastFlushAt = nowMs();
    storage.remove(STORAGE_KEY$1);
    return snapshot;
  }
  function rollback(snapshot) {
    if (!snapshot)
      return;
    for (const lt of Object.keys(snapshot)) {
      const arr = snapshot[lt];
      if (!Array.isArray(arr) || arr.length === 0)
        continue;
      if (!state.bucket[lt])
        state.bucket[lt] = [];
      state.bucket[lt] = arr.concat(state.bucket[lt]);
    }
    enforceCapacity();
    persistBucket();
  }
  function size() {
    let n2 = 0;
    for (const lt of Object.keys(state.bucket)) {
      n2 += state.bucket[lt].length;
    }
    return n2;
  }
  const STORAGE_KEY = "retry:queue";
  const DEFAULT_MAX_ITEMS = 50;
  const DEFAULT_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1e3;
  const DEFAULT_MAX_ATTEMPTS = RETRY_MAX_ATTEMPTS;
  const config = {
    maxItems: DEFAULT_MAX_ITEMS,
    maxAgeMs: DEFAULT_MAX_AGE_MS,
    maxAttempts: DEFAULT_MAX_ATTEMPTS
  };
  function readQueue() {
    const raw = storage.safeRead(STORAGE_KEY);
    if (!raw.ok || !Array.isArray(raw.value))
      return [];
    return raw.value.filter((it) => it && typeof it.id === "string" && it.payload && typeof it.payload === "object");
  }
  function writeQueue(items) {
    if (items.length === 0) {
      storage.remove(STORAGE_KEY);
      return;
    }
    storage.set(STORAGE_KEY, items);
  }
  function genId(payload) {
    if (payload._id)
      return payload._id;
    return "r-" + nowMs().toString(36) + "-" + Math.random().toString(36).slice(2, 6);
  }
  function persist(payload) {
    if (!payload)
      return void 0;
    const id = genId(payload);
    const items = readQueue();
    if (items.some((it) => it.id === id)) {
      return id;
    }
    const item = {
      id,
      payload: Object.assign({}, payload, { _id: id }),
      createdAt: nowMs(),
      attempts: 0
    };
    items.push(item);
    while (items.length > config.maxItems) {
      const dropped = items.shift();
      logger.warn("[uni统计 2.0] retry queue overflow, drop oldest", dropped === null || dropped === void 0 ? void 0 : dropped.id);
    }
    writeQueue(items);
    return id;
  }
  function loadAll() {
    const items = readQueue();
    if (items.length === 0)
      return [];
    const cutoff = nowMs() - config.maxAgeMs;
    const alive = [];
    for (const it of items) {
      if (it.createdAt < cutoff) {
        logger.warn("[uni统计 2.0] retry item expired, drop", it.id);
        continue;
      }
      alive.push(it);
    }
    if (alive.length !== items.length)
      writeQueue(alive);
    return alive.map((it) => it.payload);
  }
  function ack(id) {
    if (!id)
      return;
    const items = readQueue();
    const next = items.filter((it) => it.id !== id);
    if (next.length === items.length)
      return;
    writeQueue(next);
  }
  function markAttempt(id) {
    if (!id)
      return;
    const items = readQueue();
    let nextItems = null;
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      if (it.id !== id)
        continue;
      it.attempts++;
      if (it.attempts >= config.maxAttempts) {
        logger.warn("[uni统计 2.0] retry item exceeded maxAttempts, drop as dead letter", id, "attempts=" + it.attempts);
        nextItems = items.slice(0, i).concat(items.slice(i + 1));
      } else {
        nextItems = items;
      }
      break;
    }
    if (nextItems)
      writeQueue(nextItems);
  }
  let instance = null;
  class StatApp {
    constructor() {
      this.installed = false;
      this.statVersion = "image";
    }
    static getInstance() {
      if (!instance)
        instance = new StatApp();
      return instance;
    }
    /**
     * 一次性装配。重复调用直接返回。
     *
     * @param config 业务配置；缺省值兼容私有版默认行为。
     * @param overrides 测试钩子。
     */
    install(config2 = {}, overrides = {}) {
      var _a, _b, _c, _d, _e;
      if (this.installed)
        return;
      const cfg = this.normalizeConfig(config2);
      this.config = cfg;
      this.statVersion = cfg.version;
      tryRun(() => configure$1({
        backgroundTimeoutSec: cfg.backgroundTimeoutSec,
        pageInactiveTimeoutSec: cfg.pageInactiveTimeoutSec
      }), void 0);
      tryRun(() => configure({ intervalSec: cfg.reportIntervalSec }), void 0);
      if (!overrides.skipMigration) {
        tryRun(() => migrateLegacyData(), false);
      }
      tryRun(() => loadVisitSnapshot(), void 0);
      this.httpChannel = (_b = (_a = overrides.channels) === null || _a === void 0 ? void 0 : _a.http) !== null && _b !== void 0 ? _b : createHttpChannel({ ut: getPlatform(), maxRetries: HTTP_MAX_RETRIES });
      if (overrides.channels && "cloud" in overrides.channels) {
        this.cloudChannel = (_c = overrides.channels.cloud) !== null && _c !== void 0 ? _c : void 0;
      } else if (this.statVersion === "2") {
        this.cloudChannel = createCloudChannel({ maxRetries: CLOUD_MAX_RETRIES });
      } else {
        this.cloudChannel = void 0;
      }
      if (overrides.channels && "image" in overrides.channels) {
        this.imageChannel = (_d = overrides.channels.image) !== null && _d !== void 0 ? _d : void 0;
      } else if (this.statVersion === "image") {
        this.imageChannel = createImageChannel({
          host: IMAGE_REPORT_DEFAULTS.host,
          projectId: IMAGE_REPORT_DEFAULTS.projectId,
          topicId: IMAGE_REPORT_DEFAULTS.topicId,
          maxRetries: IMAGE_MAX_RETRIES,
          ut: getPlatform(),
          rawPlatform: getRawPlatform()
        });
      } else {
        this.imageChannel = void 0;
      }
      this.collectorDeps = this.buildCollectorDeps(cfg, (_e = overrides.collectorDepsPatch) !== null && _e !== void 0 ? _e : {});
      this.collector = createCollector(this.collectorDeps);
      if (!overrides.skipInterceptors) {
        const c = this.collector;
        this.uninstallInterceptors = tryRun(() => installAllInterceptors({ report: (i) => c.report(i) }), void 0);
      }
      if (!overrides.skipRecoverRetry) {
        void this.collector.recoverRetry().catch((e) => logger.warn("[uni统计 2.0] recoverRetry failed", e));
      }
      this.uninstallNetworkWatch = tryRun(() => onNetworkOnline(() => {
        const c = this.collector;
        if (!c)
          return;
        void c.recoverRetry().catch((e) => logger.warn("[uni统计 2.0] recoverRetry on online failed", e));
        void c.flush(true).catch((e) => logger.warn("[uni统计 2.0] flush on online failed", e));
      }), void 0);
      this.installed = true;
    }
    /**
     * 业务侧 `uni.report(type, value)` 入口。
     *
     * 兼容私有版语义：
     *   - `type === 'title'` → 写 reportTitle，不发事件；下次 lt=11 / lt=3 携带 `ttc`。
     *   - 其他 type → 自定义事件 lt=21，custom `{ e_n: type, e_v: value }`。
     */
    report(type, value) {
      if (!this.installed || !this.collector)
        return;
      if (type === "title") {
        setReportTitle(value);
        return;
      }
      const ev = typeof value === "object" && value !== null ? tryRun(() => JSON.stringify(value), "") : value === void 0 ? "" : String(value);
      this.collector.report({
        lt: LT.Event,
        custom: { e_n: type, e_v: ev }
      });
    }
    /** 上报 onError 捕获的错误。 */
    reportError(err) {
      var _a;
      if (!this.installed || !this.collector)
        return;
      const errMsg = err instanceof Error ? `${err.name}: ${err.message}
${(_a = err.stack) !== null && _a !== void 0 ? _a : ""}` : typeof err === "string" ? err : tryRun(() => JSON.stringify(err), "");
      this.collector.report({ lt: LT.Error, errMsg });
    }
    /** 取 collector，供 lifecycleHooks 调度生命周期事件。 */
    getCollector() {
      return this.collector;
    }
    /** 取 deps（测试用）。 */
    getDeps() {
      return this.collectorDeps;
    }
    /** 是否已 install。 */
    isInstalled() {
      return this.installed;
    }
    /** 当前协议版本。 */
    getStatVersion() {
      return this.statVersion;
    }
    /** 当前生效配置（含默认值合并），测试用。 */
    getConfig() {
      return this.config;
    }
    /**
     * 卸载（测试 / hot reload）。
     *
     * 解绑全部拦截器、清空内部句柄。**不**清外部模块（queue/visit/session）状态，
     * 那些由各自的 `__reset*` 在测试 setup 中处理。
     */
    uninstall() {
      if (this.uninstallInterceptors) {
        tryRun(() => this.uninstallInterceptors(), void 0);
      }
      this.uninstallInterceptors = void 0;
      if (this.uninstallNetworkWatch) {
        tryRun(() => this.uninstallNetworkWatch(), void 0);
      }
      this.uninstallNetworkWatch = void 0;
      if (this.collector) {
        tryRun(() => this.collector.destroy(), void 0);
      }
      this.collector = void 0;
      this.collectorDeps = void 0;
      this.httpChannel = void 0;
      this.cloudChannel = void 0;
      this.imageChannel = void 0;
      this.config = void 0;
      this.installed = false;
    }
    /**
     * 解析上行渠道字段 `ch`。
     *
     * App 渠道包标识只能以原生运行时为准：`plus.runtime.channel`。
     * `manifest.uniStatistics.ch` 是静态配置，不能区分同一项目打出的多渠道包。
     * 非 App 端没有 `plus.runtime.channel` 语义，保留手动 install 传入 `ch` 的能力。
     */
    resolveChannel(explicit) {
      if (isApp()) {
        return getAppChannel();
      }
      if (typeof explicit === "string" && explicit.length > 0) {
        return explicit;
      }
      return "";
    }
    resolveFirstFlushDeferMs() {
      if (getRawPlatform() === "mp-weixin" && MP_WEIXIN_USE_PRELOAD_ASSETS_REPORT) {
        return MP_WEIXIN_PRELOAD_FIRST_FLUSH_DELAY_MS;
      }
      if (isApp() && !getAppChannel()) {
        return APP_CHANNEL_FIRST_FLUSH_DELAY_MS;
      }
      return 0;
    }
    normalizeConfig(c) {
      var _a, _b, _c, _d;
      return {
        ak: (_a = c.ak) !== null && _a !== void 0 ? _a : getAppId$1(),
        v: c.v,
        ch: this.resolveChannel(c.ch),
        version: (_b = c.version) !== null && _b !== void 0 ? _b : "image",
        backgroundTimeoutSec: (_c = c.backgroundTimeoutSec) !== null && _c !== void 0 ? _c : 300,
        pageInactiveTimeoutSec: (_d = c.pageInactiveTimeoutSec) !== null && _d !== void 0 ? _d : 1800,
        reportIntervalSec: typeof c.reportIntervalSec === "number" ? c.reportIntervalSec : REPORT_INTERVAL_SEC,
        // collectItems 默认值与私有版严格对齐：push 默认关闭、页面日志默认开启
        enablePush: c.enablePush === true,
        enablePageLog: c.enablePageLog !== false
      };
    }
    /**
     * 构建 collector 依赖。所有 adapter 调用都包了 `tryRun`，避免单端缺失 API 导致
     * install 失败。
     */
    buildCollectorDeps(cfg, patch) {
      const platformShort = getPlatform();
      const builder = createStatDataBuilder({
        config: {
          ak: cfg.ak,
          usv: STAT_VERSION_PUBLIC,
          v: cfg.v,
          get ch() {
            return isApp() ? getAppChannel() : cfg.ch;
          }
        },
        platform: {
          ut: platformShort
        },
        system: tryRun(() => getSystemInfo(), {
          brand: "",
          md: "",
          sv: "",
          v: "",
          ut: "unknown",
          appVersion: "",
          appWgtVersion: "",
          mpvHostVersion: "",
          on: "",
          sdkVersion: "",
          statusBarHeight: 0,
          osP: ""
        }),
        locale: tryRun(() => getLocaleAndScreen(), {
          lang: "",
          ww: 0,
          wh: 0,
          sw: 0,
          sh: 0,
          pr: 1
        }),
        device: {
          // 惰性解析：每次 build 时再调 getUuid()，避免 install 过早（uni 运行时未就绪）冻结临时值。
          get uuid() {
            return tryRun(() => getUuid(), "");
          }
        },
        net: { net: "unknown", raw: "" },
        location: { lat: "", lng: "", ok: false },
        pkg: tryRun(() => getPackageInfo(), {
          mpn: "",
          tdaid: "",
          pkn: "",
          an: ""
        }),
        web: tryRun(() => getWebInfo(), { domain: "" })
      });
      const base = {
        builder,
        queue: {
          enqueue,
          flush,
          rollback,
          shouldFlush
        },
        serializer: { handleData },
        selectChannel: () => selectChannel({
          version: this.statVersion,
          http: this.httpChannel,
          cloud: this.cloudChannel,
          image: this.imageChannel
        }),
        retry: {
          persist,
          loadAll,
          ack,
          markAttempt
        },
        visit: {
          commitVisitOnAck,
          rollbackPendingVisit
        },
        session: {
          getSnapshot,
          nextSeq,
          touch
        },
        config: { usv: STAT_VERSION_PUBLIC },
        resolveUploadFields: () => {
          const ch = getAppChannel();
          return ch ? { ch } : {};
        },
        nowMs,
        nowSec,
        firstFlushDeferMs: this.resolveFirstFlushDeferMs(),
        isNetworkOffline
      };
      return Object.assign(base, patch);
    }
  }
  function getStatApp() {
    return StatApp.getInstance();
  }
  function parseInjectedUniStatistics() {
    const raw = "{}";
    const trimmed = raw.trim();
    if (!trimmed || trimmed === "undefined")
      return void 0;
    try {
      const obj = JSON.parse(trimmed);
      if (!obj || typeof obj !== "object" || Array.isArray(obj))
        return void 0;
      return obj;
    } catch (_e) {
      return void 0;
    }
  }
  function readManifestStatConfig() {
    try {
      const obj = parseInjectedUniStatistics();
      if (!obj)
        return void 0;
      const cfg = {};
      if (obj.channelVersion != null) {
        const v = String(obj.channelVersion);
        if (v === "1" || v === "2" || v === "image")
          cfg.version = v;
      }
      const bg = pickPositiveNumber(obj.backgroundTimeout, obj.backgroundTimeoutSec);
      if (bg !== void 0)
        cfg.backgroundTimeoutSec = bg;
      const pi = pickPositiveNumber(obj.pageInactiveTimeout, obj.pageInactiveTimeoutSec);
      if (pi !== void 0)
        cfg.pageInactiveTimeoutSec = pi;
      const ri = pickNonNegativeNumber(obj.reportInterval, obj.reportIntervalSec);
      if (ri !== void 0)
        cfg.reportIntervalSec = ri;
      if (obj.collectItems && typeof obj.collectItems === "object") {
        const items = obj.collectItems;
        if (typeof items.uniPushClientID === "boolean") {
          cfg.enablePush = items.uniPushClientID;
        }
        if (typeof items.uniStatPageLog === "boolean") {
          cfg.enablePageLog = items.uniStatPageLog;
        }
      }
      return Object.keys(cfg).length > 0 ? cfg : void 0;
    } catch (e) {
      logger.warn("[uni统计 2.0] readManifestStatConfig failed", e);
      return void 0;
    }
  }
  function normalizePositiveNumber(value) {
    if (typeof value === "number") {
      return value > 0 ? value : void 0;
    }
    if (typeof value === "string") {
      const t = value.trim();
      if (t === "")
        return void 0;
      const n2 = Number(t);
      if (Number.isFinite(n2) && n2 > 0)
        return n2;
    }
    return void 0;
  }
  function normalizeNonNegativeNumber(value) {
    if (typeof value === "number") {
      return value >= 0 ? value : void 0;
    }
    if (typeof value === "string") {
      const t = value.trim();
      if (t === "")
        return void 0;
      const n2 = Number(t);
      if (Number.isFinite(n2) && n2 >= 0)
        return n2;
    }
    return void 0;
  }
  function pickPositiveNumber(...candidates) {
    for (const c of candidates) {
      const n2 = normalizePositiveNumber(c);
      if (n2 !== void 0)
        return n2;
    }
    return void 0;
  }
  function pickNonNegativeNumber(...candidates) {
    for (const c of candidates) {
      const n2 = normalizeNonNegativeNumber(c);
      if (n2 !== void 0)
        return n2;
    }
    return void 0;
  }
  function getUni() {
    const u = resolveUniRuntime();
    return u != null && typeof u === "object" ? u : void 0;
  }
  const UNI_HOOK_RETRY_MAX = 20;
  const UNI_HOOK_RETRY_MS = 50;
  let vueMixinMounted = false;
  let vueMixinRetryTimer;
  let bootstrapped = false;
  let uniHookRetryTimer;
  function installPublicStat(opts = {}) {
    if (bootstrapped)
      return;
    bootstrapped = true;
    const fromManifest = readManifestStatConfig();
    const finalConfig = Object.assign({}, fromManifest, opts.config);
    const app = getStatApp();
    tryRun(() => app.install(finalConfig, opts.overrides), void 0);
    tryRun(() => {
      var _a, _b, _c;
      const cfgBoot = app.getConfig();
      const appName = "美记账";
      const injected = parseInjectedUniStatistics();
      const bootBase = {
        channel: (_a = cfgBoot === null || cfgBoot === void 0 ? void 0 : cfgBoot.version) !== null && _a !== void 0 ? _a : "image",
        reportIntervalSec: (_b = cfgBoot === null || cfgBoot === void 0 ? void 0 : cfgBoot.reportIntervalSec) !== null && _b !== void 0 ? _b : 0,
        ak: (_c = cfgBoot === null || cfgBoot === void 0 ? void 0 : cfgBoot.ak) !== null && _c !== void 0 ? _c : "",
        appName,
        debugFromManifest: "false" === true
      };
      if (injected != null) {
        if (injected.backgroundTimeout != null || injected.backgroundTimeoutSec != null) {
          bootBase.backgroundTimeoutSec = cfgBoot === null || cfgBoot === void 0 ? void 0 : cfgBoot.backgroundTimeoutSec;
        }
        if (injected.pageInactiveTimeout != null || injected.pageInactiveTimeoutSec != null) {
          bootBase.pageInactiveTimeoutSec = cfgBoot === null || cfgBoot === void 0 ? void 0 : cfgBoot.pageInactiveTimeoutSec;
        }
      }
      logBoot(Object.assign({}, bootBase, { vueMode: "Vue3" }));
    }, void 0);
    const finishLifecycleInstall = () => {
      var _a, _b;
      const cfg = app.getConfig();
      const lifecycleOpts = Object.assign({}, {
        enablePush: (_a = cfg === null || cfg === void 0 ? void 0 : cfg.enablePush) !== null && _a !== void 0 ? _a : false,
        enablePageLog: (_b = cfg === null || cfg === void 0 ? void 0 : cfg.enablePageLog) !== null && _b !== void 0 ? _b : true
      }, opts.lifecycle);
      const { mixin } = bindLifecycle(app, lifecycleOpts);
      if (!opts.skipVueMixin) {
        tryRun(() => mountVueMixin(mixin), void 0);
      }
      if (!opts.skipUniReport) {
        tryRun(() => mountUniReport(app), void 0);
      }
      if (shouldBindUniAppLifecycle() && !tryBindUniAppLifecycle(app, lifecycleOpts)) {
        scheduleUniAppHookRetry(() => tryBindUniAppLifecycle(app, lifecycleOpts));
      }
    };
    finishLifecycleInstall();
  }
  function scheduleUniAppHookRetry(tryBind) {
    if (uniHookRetryTimer) {
      clearTimeout(uniHookRetryTimer);
      uniHookRetryTimer = void 0;
    }
    let attempts = 0;
    const tick = () => {
      if (tryBind())
        return;
      if (++attempts >= UNI_HOOK_RETRY_MAX) {
        logger.warn("[uni统计 2.0] Vue3 小程序：uni.onAppShow 暂不可用，应用前后台统计可能缺失");
        return;
      }
      uniHookRetryTimer = setTimeout(tick, UNI_HOOK_RETRY_MS);
    };
    uniHookRetryTimer = setTimeout(tick, UNI_HOOK_RETRY_MS);
  }
  function tryRegisterVueAppMixin(mixin) {
    try {
      ;
      uni.onCreateVueApp((vueApp) => {
        tryRun(() => vueApp.mixin(mixin), void 0);
      });
      return true;
    } catch (_e) {
    }
    const u = getUni();
    if (u && typeof u.onCreateVueApp === "function") {
      u.onCreateVueApp((vueApp) => {
        tryRun(() => vueApp.mixin(mixin), void 0);
      });
      return true;
    }
    return false;
  }
  function mountVueMixin(mixin) {
    if (vueMixinMounted)
      return;
    if (tryRegisterVueAppMixin(mixin)) {
      vueMixinMounted = true;
      return;
    }
    scheduleVueAppMixinRetry(mixin);
  }
  function scheduleVueAppMixinRetry(mixin) {
    if (vueMixinMounted)
      return;
    if (vueMixinRetryTimer)
      return;
    let attempts = 0;
    const tick = () => {
      vueMixinRetryTimer = void 0;
      if (vueMixinMounted)
        return;
      if (tryRegisterVueAppMixin(mixin)) {
        vueMixinMounted = true;
        return;
      }
      if (++attempts >= UNI_HOOK_RETRY_MAX) {
        if (!vueMixinMounted) {
          logger.warn("[uni统计 2.0] Vue3: onCreateVueApp 在重试后仍不可用，页面级 mixin 未注入");
        }
        return;
      }
      vueMixinRetryTimer = setTimeout(tick, UNI_HOOK_RETRY_MS);
    };
    vueMixinRetryTimer = setTimeout(tick, UNI_HOOK_RETRY_MS);
  }
  function mountUniReport(app) {
    var _a;
    const g = getGlobalObject();
    const u = (_a = getUni()) !== null && _a !== void 0 ? _a : g.uni;
    if (!u || typeof u !== "object")
      return;
    u.report = (type, value) => {
      app.report(type, value);
    };
  }
  installPublicStat();
  function createApp() {
    const app = vue.createVueApp(App);
    return { app };
  }
  const { app: __app__, Vuex: __Vuex__, Pinia: __Pinia__ } = createApp();
  uni.Vuex = __Vuex__;
  uni.Pinia = __Pinia__;
  __app__.provide("__globalStyles", __uniConfig.styles);
  __app__._component.mpType = "app";
  __app__._component.render = () => {
  };
  __app__.mount("#app");
})(Vue);
