# Flutter 项目结构规范

## 目录布局（Feature-first）

```
mobile/
├── lib/
│   ├── core/                ← 基础设施（全局共享）
│   │   ├── constants/       ← 全局常量
│   │   │   ├── app_colors.dart
│   │   │   └── app_strings.dart
│   │   ├── exceptions/      ← 自定义异常类型
│   │   │   └── app_exceptions.dart
│   │   ├── extensions/      ← Dart 扩展方法
│   │   ├── network/         ← Dio 实例 + 拦截器
│   │   │   ├── dio_provider.dart
│   │   │   └── auth_interceptor.dart
│   │   ├── router/          ← GoRouter 路由定义
│   │   │   └── app_router.dart
│   │   ├── theme/           ← ThemeData 定义
│   │   │   └── app_theme.dart
│   │   └── logger.dart      ← 全局 Logger 实例
│   ├── features/            ← 按功能模块划分（核心目录）
│   │   ├── auth/
│   │   │   ├── data/        ← Repository 实现 + 数据模型
│   │   │   │   ├── auth_repository_impl.dart
│   │   │   │   └── auth_dto.dart
│   │   │   ├── domain/      ← 接口 + 领域实体
│   │   │   │   ├── auth_repository.dart
│   │   │   │   └── user.dart
│   │   │   ├── providers/   ← Riverpod Provider
│   │   │   │   └── auth_provider.dart
│   │   │   └── presentation/
│   │   │       ├── pages/
│   │   │       │   └── login_page.dart
│   │   │       └── widgets/
│   │   │           └── login_form.dart
│   │   ├── orders/
│   │   └── users/
│   ├── shared/              ← 全局共享 Widget（不含业务逻辑）
│   │   ├── widgets/
│   │   │   ├── app_button.dart
│   │   │   ├── app_text_field.dart
│   │   │   └── loading_overlay.dart
│   │   └── providers/       ← 全局 Provider（如 themeProvider）
│   └── main.dart
├── test/
│   ├── features/            ← 与 lib/features 镜像结构
│   └── helpers/             ← 测试工具函数
├── pubspec.yaml
└── analysis_options.yaml
```

---

## Feature 分层规范

每个 Feature 遵循 **domain / data / providers / presentation** 四层：

```
features/orders/
├── domain/
│   ├── order.dart           ← 领域实体（纯 Dart 类）
│   └── order_repository.dart ← 抽象接口
├── data/
│   ├── order_dto.dart       ← JSON 映射（fromJson/toJson）
│   └── order_repository_impl.dart ← 实现接口
├── providers/
│   ├── order_repository_provider.dart  ← 注入 Impl
│   └── order_list_provider.dart        ← 业务 Provider
└── presentation/
    ├── pages/
    │   ├── order_list_page.dart
    │   └── order_detail_page.dart
    └── widgets/
        ├── order_card.dart
        └── order_filter.dart
```

### 分层职责

| 层 | 职责 | 禁止 |
|----|------|------|
| `domain/` | 领域实体 + 仓库接口 | 不依赖 Flutter、Dio、任何框架 |
| `data/` | 实现仓库接口，处理 JSON | 不含 UI 逻辑，不用 BuildContext |
| `providers/` | 状态逻辑 + 依赖注入 | 不做 UI 操作（no showDialog） |
| `presentation/` | 渲染 UI，响应状态 | 不写业务逻辑，不直接调 API |

---

## 路由规范（GoRouter）

```dart
// core/router/app_router.dart
@riverpod
GoRouter appRouter(AppRouterRef ref) {
  final authState = ref.watch(authStateProvider);

  return GoRouter(
    initialLocation: '/home',
    redirect: (context, state) {
      final isAuthenticated = authState.value != null;
      final isLoginPage = state.matchedLocation == '/login';

      if (!isAuthenticated && !isLoginPage) return '/login';
      if (isAuthenticated && isLoginPage) return '/home';
      return null;
    },
    routes: [
      GoRoute(
        path: '/login',
        builder: (_, __) => const LoginPage(),
      ),
      ShellRoute(
        builder: (_, __, child) => AppShell(child: child),
        routes: [
          GoRoute(
            path: '/home',
            builder: (_, __) => const HomePage(),
          ),
          GoRoute(
            path: '/orders',
            builder: (_, __) => const OrderListPage(),
            routes: [
              GoRoute(
                path: ':id',
                builder: (_, state) => OrderDetailPage(
                  id: state.pathParameters['id']!,
                ),
              ),
            ],
          ),
        ],
      ),
    ],
  );
}
```

---

## 数据传递规范

```dart
// ✅ 页面间传参：通过路由 pathParameters 或 extra
GoRoute(
  path: '/orders/:id',
  builder: (_, state) => OrderDetailPage(id: state.pathParameters['id']!),
)

// ✅ 同一 Feature 内：通过 Provider 共享
// ✅ 跨 Feature：通过顶层 Provider（global）

// ❌ 禁止：用 GlobalKey 或 InheritedWidget 手动传递复杂状态
```

---

## pubspec.yaml 依赖规范

```yaml
dependencies:
  flutter:
    sdk: flutter

  # 状态管理
  flutter_riverpod: ^2.5.0
  riverpod_annotation: ^2.3.0

  # 路由
  go_router: ^14.0.0

  # 网络
  dio: ^5.4.0

  # 本地存储
  flutter_secure_storage: ^9.0.0
  shared_preferences: ^2.2.0

  # 日志
  logger: ^2.3.0

  # 工具
  freezed_annotation: ^2.4.0
  json_annotation: ^4.9.0

dev_dependencies:
  flutter_test:
    sdk: flutter
  
  riverpod_generator: ^2.4.0
  build_runner: ^2.4.0
  freezed: ^2.5.0
  json_serializable: ^6.8.0
  
  mocktail: ^1.0.0
  flutter_lints: ^4.0.0
```

---

## analysis_options.yaml

```yaml
include: package:flutter_lints/flutter.yaml

analyzer:
  language:
    strict-casts: true
    strict-inference: true
    strict-raw-types: true
  errors:
    missing_required_param: error
    missing_return: error

linter:
  rules:
    - avoid_print
    - prefer_const_constructors
    - prefer_const_declarations
    - use_super_parameters
    - avoid_unnecessary_containers
```
