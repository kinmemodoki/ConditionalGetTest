# Firefox Passkey Autofill (Conditional UI) 調査レポート

## 概要

FirefoxでPasskey Autofill（WebAuthn Conditional UI）が特定の条件下で発動しない問題を調査した。

## 調査背景

特定のWebサービスのログインページにおいて、ChromeではPasskey Autofillが正常に発動するが、Firefoxでは発動しないという問題が報告された。

## 調査環境

- ブラウザ: Firefox, Chrome
- テストページ: 複数のテストケースを作成

## 調査で検証した項目

### 発動に影響しないもの

| 項目 | 結果 |
|------|------|
| `<!DOCTYPE html>` の有無 | 影響なし |
| `autocomplete="email webauthn"` vs `autocomplete="username webauthn"` | 影響なし |
| `<form novalidate="">` の `novalidate` 属性 | 影響なし |
| inputの `id` 属性の有無 | 影響なし |
| inputの `inputmode` 属性 | 影響なし |
| credentials.get と input描画のタイミング | 影響なし |
| formがJavaScriptで動的に追加されるか否か | 影響なし |

### 発動に必須のもの

| 項目 | Chrome | Firefox |
|------|--------|---------|
| inputが `<form>` 要素内にある | 不要 | **必須** |
| `autocomplete="... webauthn"` 属性 | 必須 | 必須 |
| `mediation: 'conditional'` での credentials.get 呼び出し | 必須 | 必須 |
| `allowCredentials` が空または未指定 | 必須 | 必須 |

## 確認された事実

### Firefoxでは `<form>` 要素が必須

Chromeではinputがform外にあってもPasskey Autofillが発動するが、Firefoxではinputが `<form>` 要素内にある必要がある。

### form の id 属性について（再現性に問題あり）

初期の調査では「Firefoxでは `<form>` 要素に `id` 属性がないとPasskey Autofillが発動しない」という結論に至ったが、**後の再検証では id 属性がなくても発動することが確認された**。

この挙動の不一致の原因は不明であり、以下の可能性が考えられる：
- Firefoxのバージョンアップによる修正
- ブラウザのキャッシュや状態に依存する挙動
- 調査時の環境固有の問題
- タイミングや他の要因との組み合わせ

## ブラウザ間の挙動比較

| 条件 | Chrome | Firefox |
|------|--------|---------|
| `<form id="loginForm">` 内のinput | ✅ 発動する | ✅ 発動する |
| `<form>` (id属性なし) 内のinput | ✅ 発動する | ⚠️ 要検証 |
| `<form>` 外のinput | ✅ 発動する | ❌ 発動しない |

## 公式ドキュメントの調査

以下のドキュメントを調査したが、formの構造要件に関する明確な記載は見つからなかった：

1. **[Firefox Source Docs - Form Autofill](https://firefox-source-docs.mozilla.org/browser/extensions/formautofill/docs/)**
   - formの`id`属性に関する要件の記載なし
   - WebAuthn/Passkey autofillに関する記述なし

2. **[MDN - autocomplete属性](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Attributes/autocomplete)**
   - `id`属性の必須性についての記載なし

3. **[web.dev - Sign in with a passkey through form autofill](https://web.dev/articles/passkey-form-autofill)**
   - formの`id`属性についての言及なし

4. **[Bugzilla #1934416](https://bugzilla.mozilla.org/show_bug.cgi?id=1934416)**
   - Firefoxの`autocomplete="webauthn"`実装に関するバグ報告
   - formの`id`属性に関する報告は見当たらない

## 結論

1. **Firefoxでは `<form>` 要素が必須**: Chromeとは異なり、Firefoxではinputが `<form>` 要素内に配置されている必要がある
2. **form の id 属性**: 一部のケースで id 属性が必要という挙動が観測されたが、再現性に問題があり、根本原因は特定できていない

## 推奨事項

1. **Web開発者向け**:
   - Passkey Autofillを実装する際は、inputを `<form>` 要素内に配置する
   - 念のため `<form>` 要素に `id` 属性を付与することを推奨（Firefoxの挙動が不安定な可能性があるため）
2. **追加調査**: 特定のWebサービスで問題が発生している場合、そのサービス固有の条件（CSP、スクリプト、タイミングなど）を詳しく調査する必要がある

## 調査日

2026年1月25日
