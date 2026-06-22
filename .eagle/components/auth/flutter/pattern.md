# Auth — Flutter 移动端实现模式

---

## 目录结构

```
mobile/lib/features/auth/
├── domain/
│   ├── user.dart                    ← User 实体
│   └── auth_repository.dart         ← 接口
├── data/
│   ├── auth_dto.dart                ← JSON 映射
│   └── auth_repository_impl.dart    ← 实现
├── providers/
│   ├── auth_repository_provider.dart
│   └── auth_provider.dart           ← 核心状态 Provider
└── presentation/
    ├── pages/
    │   └── login_page.dart
    └── widgets/
        └── login_form.dart
```

---

## 核心实现模式

### Token 存储

```dart
// 分开存储两种 token
// access_token → 内存（Provider state），不持久化
// refresh_token → flutter_secure_storage（加密持久化）

// core/storage/token_storage.dart
class TokenStorage {
  final _storage = const FlutterSecureStorage();
  static const _refreshKey = 'refresh_token';

  Future<void> saveRefreshToken(String token) =>
      _storage.write(key: _refreshKey, value: token);

  Future<String?> getRefreshToken() =>
      _storage.read(key: _refreshKey);

  Future<void> deleteRefreshToken() =>
      _storage.delete(key: _refreshKey);
}
```

### 认证状态（Riverpod）

```dart
// features/auth/providers/auth_provider.dart

@Riverpod(keepAlive: true)  // 全局状态，不随 Widget dispose
class Auth extends _$Auth {
  @override
  Future<User?> build() async {
    // App 启动时尝试恢复会话
    return await _tryRestoreSession();
  }

  Future<User?> _tryRestoreSession() async {
    final tokenStorage = ref.read(tokenStorageProvider);
    final refreshToken = await tokenStorage.getRefreshToken();

    if (refreshToken == null) return null;

    try {
      final repo = ref.read(authRepositoryProvider);
      final result = await repo.refreshToken(refreshToken);
      _setAccessToken(result.accessToken);
      await tokenStorage.saveRefreshToken(result.refreshToken);
      return result.user;
    } catch (_) {
      await tokenStorage.deleteRefreshToken();
      return null;
    }
  }

  Future<void> login(String email, String password) async {
    state = const AsyncLoading();
    state = await AsyncValue.guard(() async {
      final repo = ref.read(authRepositoryProvider);
      final result = await repo.login(email, password);

      // 存 refresh_token
      await ref.read(tokenStorageProvider).saveRefreshToken(result.refreshToken);
      // access_token 注入 Dio 拦截器
      _setAccessToken(result.accessToken);

      return result.user;
    });
  }

  Future<void> logout() async {
    try {
      final token = ref.read(accessTokenProvider);
      await ref.read(authRepositoryProvider).logout(token ?? '');
    } finally {
      await ref.read(tokenStorageProvider).deleteRefreshToken();
      _clearAccessToken();
      state = const AsyncData(null);
    }
  }

  void _setAccessToken(String token) {
    ref.read(accessTokenProvider.notifier).state = token;
  }

  void _clearAccessToken() {
    ref.read(accessTokenProvider.notifier).state = null;
  }
}

// access_token 单独 Provider（注入 Dio 拦截器使用）
@Riverpod(keepAlive: true)
class AccessToken extends _$AccessToken {
  @override
  String? build() => null;
}
```

### Dio 认证拦截器

```dart
// core/network/auth_interceptor.dart
class AuthInterceptor extends Interceptor {
  AuthInterceptor(this._ref);
  final Ref _ref;

  @override
  void onRequest(RequestOptions options, RequestInterceptorHandler handler) {
    final token = _ref.read(accessTokenProvider);
    if (token != null) {
      options.headers['Authorization'] = 'Bearer $token';
    }
    handler.next(options);
  }

  @override
  void onError(DioException err, ErrorInterceptorHandler handler) async {
    if (err.response?.statusCode != 401) {
      handler.next(err);
      return;
    }

    // 尝试刷新 Token
    try {
      final tokenStorage = _ref.read(tokenStorageProvider);
      final refreshToken = await tokenStorage.getRefreshToken();

      if (refreshToken == null) throw Exception('no refresh token');

      final repo = _ref.read(authRepositoryProvider);
      final result = await repo.refreshToken(refreshToken);

      await tokenStorage.saveRefreshToken(result.refreshToken);
      _ref.read(accessTokenProvider.notifier).state = result.accessToken;

      // 重试原始请求
      err.requestOptions.headers['Authorization'] = 'Bearer ${result.accessToken}';
      final response = await Dio().fetch(err.requestOptions);
      handler.resolve(response);
    } catch (_) {
      // 刷新失败，强制登出
      await _ref.read(authProvider.notifier).logout();
      handler.next(err);
    }
  }
}
```

### 路由保护（GoRouter redirect）

```dart
// core/router/app_router.dart
@riverpod
GoRouter appRouter(AppRouterRef ref) {
  final authState = ref.watch(authProvider);

  return GoRouter(
    redirect: (context, state) {
      // 还在加载 → 不重定向（显示 splash）
      if (authState.isLoading) return null;

      final isAuthenticated = authState.value != null;
      final isAuthRoute = state.matchedLocation.startsWith('/login') ||
                         state.matchedLocation.startsWith('/register');

      if (!isAuthenticated && !isAuthRoute) return '/login';
      if (isAuthenticated && isAuthRoute) return '/home';
      return null;
    },
    // ...routes
  );
}
```

---

## 关键注意事项

1. `keepAlive: true` 使 `Auth` Provider 跨 Widget 存活，不随页面销毁
2. refresh_token 用 `flutter_secure_storage`（iOS Keychain / Android EncryptedSharedPreferences）
3. access_token 只存内存（Provider state），App 关闭即失效
4. Dio 拦截器的 retry 必须用新的 `Dio()` 实例（避免无限循环拦截）
5. GoRouter 的 `redirect` 每次路由变化都会触发，`authState.isLoading` 时返回 null 等待
