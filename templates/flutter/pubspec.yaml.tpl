name: {{PROJECT_NAME}}
description: {{PROJECT_NAME}} Flutter App
publish_to: 'none'
version: 1.0.0+1

environment:
  sdk: '>=3.0.0 <4.0.0'

dependencies:
  flutter:
    sdk: flutter

  # 状态管理
  flutter_riverpod: ^2.5.1
  riverpod_annotation: ^2.3.5

  # 路由
  go_router: ^14.2.7

  # 网络
  dio: ^5.5.0

  # 本地存储
  flutter_secure_storage: ^9.2.2
  shared_preferences: ^2.3.0

  # 日志
  logger: ^2.3.0

  # 工具
  freezed_annotation: ^2.4.4
  json_annotation: ^4.9.0

dev_dependencies:
  flutter_test:
    sdk: flutter

  riverpod_generator: ^2.4.3
  build_runner: ^2.4.11
  freezed: ^2.5.7
  json_serializable: ^6.8.0

  mocktail: ^1.0.4
  flutter_lints: ^4.0.0

flutter:
  uses-material-design: true
