# Flutter 测试规范

## 工具栈

- `flutter_test` — 官方测试框架（Widget 测试 + 单元测试）
- `mocktail` — Mock 框架（零 codegen）
- `riverpod` ProviderContainer — 隔离 Provider 测试

---

## 三类测试

| 类型 | 工具 | 速度 | 适用 |
|------|------|------|------|
| Unit Test | `flutter_test` + `mocktail` | 极快 | Repository、Notifier、工具函数 |
| Widget Test | `flutter_test` | 快 | 单个 Widget 交互和渲染 |
| Integration Test | `integration_test` | 慢 | 完整流程（谨慎使用） |

---

## Unit Test — Notifier/Provider

```dart
// test/features/orders/providers/order_list_provider_test.dart

import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:riverpod/riverpod.dart';

class MockOrderRepository extends Mock implements OrderRepository {}

void main() {
  late MockOrderRepository mockRepo;
  late ProviderContainer container;

  setUp(() {
    mockRepo = MockOrderRepository();
    container = ProviderContainer(
      overrides: [
        orderRepositoryProvider.overrideWithValue(mockRepo),
      ],
    );
    addTearDown(container.dispose);
  });

  group('OrderListNotifier', () {
    test('loads orders successfully', () async {
      final orders = [Order(id: '1', title: '订单A')];
      when(() => mockRepo.fetchAll()).thenAnswer((_) async => orders);

      final result = await container.read(orderListProvider.future);

      expect(result, equals(orders));
      verify(() => mockRepo.fetchAll()).called(1);
    });

    test('throws when repository fails', () async {
      when(() => mockRepo.fetchAll()).thenThrow(ApiException('network error'));

      expect(
        container.read(orderListProvider.future),
        throwsA(isA<ApiException>()),
      );
    });
  });
}
```

---

## Unit Test — Repository

```dart
// test/features/orders/data/order_repository_impl_test.dart

class MockDio extends Mock implements Dio {}

void main() {
  late MockDio mockDio;
  late OrderRepositoryImpl repo;

  setUp(() {
    mockDio = MockDio();
    repo = OrderRepositoryImpl(mockDio);
    registerFallbackValue(RequestOptions(path: ''));
  });

  test('fetchAll returns orders from API', () async {
    when(() => mockDio.get(any())).thenAnswer(
      (_) async => Response(
        data: [{'id': '1', 'title': '测试'}],
        requestOptions: RequestOptions(path: '/orders'),
        statusCode: 200,
      ),
    );

    final result = await repo.fetchAll();

    expect(result, hasLength(1));
    expect(result.first.id, '1');
  });

  test('throws UserNotFoundException on 404', () async {
    when(() => mockDio.get(any())).thenThrow(
      DioException(
        requestOptions: RequestOptions(path: '/users/999'),
        response: Response(
          statusCode: 404,
          requestOptions: RequestOptions(path: ''),
        ),
        type: DioExceptionType.badResponse,
      ),
    );

    expect(
      repo.fetchById('999'),
      throwsA(isA<UserNotFoundException>()),
    );
  });
}
```

---

## Widget Test

```dart
// test/features/orders/presentation/widgets/order_card_test.dart

void main() {
  testWidgets('OrderCard displays order info', (tester) async {
    final order = Order(id: '1', title: '测试订单', amount: 99.5);

    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(body: OrderCard(order: order)),
      ),
    );

    expect(find.text('测试订单'), findsOneWidget);
    expect(find.text('¥99.50'), findsOneWidget);
  });

  testWidgets('OrderCard calls onTap when tapped', (tester) async {
    final order = Order(id: '1', title: '测试');
    var tapped = false;

    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: OrderCard(order: order, onTap: () => tapped = true),
        ),
      ),
    );

    await tester.tap(find.byType(OrderCard));
    await tester.pump();

    expect(tapped, isTrue);
  });
}
```

### 含 Riverpod 的 Widget 测试

```dart
testWidgets('OrderListPage shows orders', (tester) async {
  final mockRepo = MockOrderRepository();
  when(() => mockRepo.fetchAll()).thenAnswer(
    (_) async => [Order(id: '1', title: '订单A')],
  );

  await tester.pumpWidget(
    ProviderScope(
      overrides: [
        orderRepositoryProvider.overrideWithValue(mockRepo),
      ],
      child: const MaterialApp(home: OrderListPage()),
    ),
  );

  // 等待异步加载
  await tester.pumpAndSettle();

  expect(find.text('订单A'), findsOneWidget);
});
```

---

## 测试文件结构

```
test/
├── features/
│   └── orders/
│       ├── data/
│       │   └── order_repository_impl_test.dart
│       ├── providers/
│       │   └── order_list_provider_test.dart
│       └── presentation/
│           └── widgets/
│               └── order_card_test.dart
└── helpers/
    ├── pump_app.dart         ← 带必要 Provider 的 pumpWidget 封装
    └── fake_data.dart        ← 测试用假数据工厂
```

### pump_app.dart 封装

```dart
// test/helpers/pump_app.dart
extension PumpApp on WidgetTester {
  Future<void> pumpApp(
    Widget widget, {
    List<Override> overrides = const [],
  }) async {
    await pumpWidget(
      ProviderScope(
        overrides: overrides,
        child: MaterialApp(home: widget),
      ),
    );
  }
}

// 使用
await tester.pumpApp(
  OrderListPage(),
  overrides: [orderRepositoryProvider.overrideWithValue(mockRepo)],
);
```

---

## 命名约定

```dart
// 格式：{描述} + (tester) 或 () 
testWidgets('displays order title and amount', (tester) async { ... })
test('throws ApiException when network fails', () async { ... })

group('OrderRepository', () {
  test('fetchAll returns empty list when no orders', () async { ... })
  test('create saves and returns new order', () async { ... })
})
```

---

## 禁止的写法

```dart
// ❌ 测试中 sleep（不稳定）
await Future.delayed(const Duration(seconds: 1));
// ✅ 等待 UI 稳定
await tester.pumpAndSettle();

// ❌ 用真实 HTTP（测试依赖网络）
final repo = OrderRepositoryImpl(Dio());
// ✅ 用 Mock
final repo = OrderRepositoryImpl(mockDio);

// ❌ 在 test() 中直接修改全局状态
setUp(() { globalToken = 'test'; })
// ✅ 用 ProviderContainer 或 overrides 隔离
```
