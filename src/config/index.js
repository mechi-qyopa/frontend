// H5 本地开发默认连接 Spring Boot 的 7002 端口；真机/小程序请通过 VITE_API_BASE_URL 配置可访问的 HTTPS 地址。
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:7002'
export const APP_TOKEN_KEY = 'mechi_app_token'
export const APP_PROFILE_KEY = 'mechi_app_profile'
