# ConditionalGetTest

WebAuthn Conditional UI (Passkey Autofill) のテストページです。

## ファイル構成

- `index.html` - メインHTMLページ
- `style.css` - スタイルシート
- `script.js` - WebAuthn実装

## 機能

### パスキーの登録
- 「パスキーを登録」ボタンをクリックすることでパスキーを登録できます
- ユーザー名は `test-user` で固定されています
- チャレンジはWebAuthn仕様に従ってランダムに生成されます
- `userVerification = "required"` で設定されています

### Conditional UI (Passkey Autofill)
- ログインフォームのユーザー名フィールドをクリックすると、登録済みのパスキーが自動的に表示されます
- `autocomplete="username webauthn"` により Conditional UI が有効になります
- 認証時も `userVerification = "required"` で設定されています

## 使用方法

1. HTTPS環境でページを開く（WebAuthnはHTTPSまたはlocalhostでのみ動作します）
2. 「パスキーを登録」ボタンをクリックしてパスキーを作成
3. ログインフォームのユーザー名フィールドをクリックして、Conditional UIでパスキーを選択

## 技術仕様

- チャレンジ: `crypto.getRandomValues()` で32バイトのランダム配列を生成
- 登録時: `authenticatorSelection.userVerification = "required"`
- 認証時: `publicKey.userVerification = "required"`
- Conditional UI: `mediation: "conditional"` オプションを使用