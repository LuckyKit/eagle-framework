# Flutter 代码风格规范

## 命名约定

| 类型 | 规范 | 示例 |
|------|------|------|
| 文件名 | snake_case | `user_card.dart`, `auth_provider.dart` |
| 类名 | UpperCamelCase | `UserCard`, `AuthNotifier` |
| 函数/方法 | lowerCamelCase | `fetchUser()`, `onPressed()` |
| 变量/参数 | lowerCamelCase | `userId`, `isLoading` |
| 常量 | lowerCamelCase（Dart 惯例）| `const maxRetry = 3` |
| 私有成员 | `_` 前缀 | `_handleTap()`, `_controller` |
| Provider | `{Feature}Provider` / `{Feature}Notifier` | `authProvider`, `UserListNotifier` |

---

## Widget 规范

### StatelessWidget（优先使用）

```dart
// ✅ 标准写法
class UserCard extends StatelessWidget {
  const UserCard({
    super.key,
    required this.user,
    this.onTap,
  });

  final User user;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    return Card(
      child: ListTile(
        title: Text(user.name),
        subtitle: Text(user.email),
        onTap: onTap,
      ),
    );
  }
}
```

**规则**：
- 构造函数参数用 `required` 标注必传项
- `const` 构造函数尽量保留（性能优化）
- `onXxx` 命名回调参数

### ConsumerWidget（需要 Riverpod）

```dart
// ✅ 读取 Provider
class OrderListPage extends ConsumerWidget {
  const OrderListPage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final ordersAsync = ref.watch(orderListProvider);

    return ordersAsync.when(
      loading: () => const CircularProgressIndicator(),
      error: (err, _) => ErrorView(message: err.toString()),
      data: (orders) => ListView.builder(
        itemCount: orders.length,
        itemBuilder: (_, i) => OrderCard(order: orders[i]),
      ),
    );
  }
}
```

### Widget 大小控制

- 单 Widget build 方法不超过 80 行
- 子 Widget 超过 30 行提取为独立 Widget 或私有方法

---

## Riverpod 状态管理规范

### Provider 类型选择

| 类型 | 用途 | 示例 |
|------|------|------|
| `Provider` | 只读计算值、依赖注入 | 工具类实例 |
| `AsyncNotifierProvider` | 异步数据 + 业务操作 | API 数据列表 |
| `NotifierProvider` | 同步状态 + 业务操作 | 购物车、表单状态 |
| `StreamProvider` | 实时数据流 | WebSocket、数据库监听 |

### AsyncNotifierProvider 标准写法

```dart
// providers/order_list_provider.dart

@riverpod
class OrderList extends _$OrderList {
  @override
  Future<List<Order>> build() async {
    return ref.watch(orderRepositoryProvider).fetchAll();
  }

  Future<void> refresh() async {
    state = const AsyncLoading();
    state = await AsyncValue.guard(() => ref.read(orderRepositoryProvider).fetchAll());
  }

  Future<void> create(CreateOrderDto dto) async {
    await ref.read(orderRepositoryProvider).create(dto);
    ref.invalidateSelf();  // 触发重新 build
  }
}
```

### 依赖注入写法

```dart
// providers/repositories.dart
@riverpod
OrderRepository orderRepository(OrderRepositoryRef ref) {
  final dio = ref.watch(dioProvider);
  return OrderRepositoryImpl(dio);
}

@riverpod
Dio dio(DioRef ref) {
  final dio = Dio(BaseOptions(baseUrl: Env.apiBaseUrl));
  dio.interceptors.add(AuthInterceptor(ref));
  return dio;
}
```

---

## 错误处理

```dart
// ✅ Repository 层：包装错误
Future<User> fetchUser(String id) async {
  try {
    final response = await _dio.get('/users/$id');
    return User.fromJson(response.data);
  } on DioException catch (e) {
    if (e.response?.statusCode == 404) {
      throw const UserNotFoundException();
    }
    throw ApiException('fetchUser failed: ${e.message}');
  }
}

// ✅ UI 层：用 AsyncValue.when 处理
ordersAsync.when(
  loading: () => const LoadingSpinner(),
  error: (err, _) {
    if (err is UserNotFoundException) {
      return const NotFoundView();
    }
    return ErrorView(message: '加载失败，请重试');
  },
  data: (orders) => OrderListView(orders: orders),
);
```

**自定义异常**：
```dart
class ApiException implements Exception {
  const ApiException(this.message);
  final String message;

  @override
  String toString() => 'ApiException: $message';
}

class UserNotFoundException implements Exception {
  const UserNotFoundException();
}
```

---

## 日志规范

使用 `logger` 包（`package:logger/logger.dart`）：

```dart
// lib/core/logger.dart
final log = Logger(
  printer: PrettyPrinter(methodCount: 0),
  level: kDebugMode ? Level.debug : Level.warning,
);

// 使用
log.i('user_created', error: null, stackTrace: null);
log.e('api_call_failed', error: e, stackTrace: st);
log.d('fetch_user id=$id');
```

**规则**：
- 禁止 `print()`（发布包会被 tree-shake 但不可控）
- 生产环境 Level.warning 以上才输出
- 错误必须传 `error` 和 `stackTrace` 参数

---

## 导入规范

```dart
// 1. Dart 标准库
import 'dart:async';
import 'dart:convert';

// 2. Flutter 框架
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

// 3. 第三方包
import 'package:riverpod_annotation/riverpod_annotation.dart';
import 'package:dio/dio.dart';

// 4. 项目内部（按层次）
import 'package:myapp/core/exceptions.dart';
import 'package:myapp/features/user/domain/user.dart';
import 'package:myapp/features/user/providers/user_provider.dart';
```

---

## 空安全规范

```dart
// ✅ 明确可空类型
String? userId;  // 可为 null
String email;    // 不可为 null，构造函数赋值

// ✅ 安全访问
final name = user?.name ?? '未知用户';

// ✅ late 变量：仅在确定初始化时序时使用
late final AuthService _authService;

@override
void initState() {
  super.initState();
  _authService = AuthService();  // 在使用前确保赋值
}

// ❌ 避免 ! 强制解包（除非确定非空且有注释）
final name = user!.name;  // 危险
```

---

## 禁止的写法

```dart
// ❌ 在 build 方法里做副作用
@override
Widget build(BuildContext context) {
  fetchData();  // 每次 rebuild 都触发！
  return Container();
}

// ✅ 在 initState 或 Provider 中处理
@override
void initState() {
  super.initState();
  WidgetsBinding.instance.addPostFrameCallback((_) => fetchData());
}

// ❌ 使用 GlobalKey 跨 Widget 通信
// ✅ 使用 Riverpod Provider 共享状态

// ❌ 硬编码颜色/字号
Text('hello', style: TextStyle(color: Color(0xFF000000), fontSize: 16))
// ✅ 使用 Theme
Text('hello', style: Theme.of(context).textTheme.bodyMedium)
```
