# Firefox Passkey Autofill (Conditional UI) 調査レポート

## 概要

FirefoxでPasskey Autofill（WebAuthn Conditional UI）が特定の条件下で発動しない問題を調査した。
特にメルカリのログインページで発動しない原因を特定した。

## 調査背景

メルカリのログインページにおいて、ChromeではPasskey Autofillが正常に発動するが、Firefoxでは発動しないという問題が報告された。

## 調査環境

- ブラウザ: Firefox, Chrome
- テストページ: 複数のテストケースを作成
- 比較対象: メルカリのログインページ (`mercari_example.html`)

## 結論: Firefox Passkey Autofill 発動条件

### autocomplete属性に `webauthn` が含まれる場合、以下のいずれかが必要

| 条件 | 発動 |
|------|------|
| `autocomplete="username webauthn"` | ✅ |
| `autocomplete="email webauthn"` | ❌ |
| `autocomplete="webauthn"` のみ | 条件付き（下記参照） |
| `autocomplete="webauthn username"` (順序逆) | ❌ |
| `autocomplete="webauthn email"` (順序逆) | ❌ |

### `autocomplete="webauthn"` 単独の場合の追加条件

| 条件 | 発動 |
|------|------|
| `type="password"` (nameは関係なし) | ✅ |
| `name="username"` (type="text"でもOK) | ✅ |
| `name="password"` + `type="text"` | ❌ |
| `name="email"` | ❌ |
| `name="emailOrPhone"` | ❌ |

### まとめ: Firefoxが認識する条件

Firefoxは以下の**いずれか**の条件でPasskey Autofillを発動する：

1. **`autocomplete="username webauthn"`** - autocomplete属性で明示的に指定
2. **`autocomplete="webauthn"` + `type="password"`** - パスワードフィールド
3. **`autocomplete="webauthn"` + `name="username"`** - name属性がusername

## メルカリが発動しない原因

メルカリのログインページの実装:

```html
<input autocomplete="email webauthn" placeholder="09000012345" inputmode="email"
       class="merInputNode" type="email" name="emailOrPhone">
```

**問題点:**
- `autocomplete="email webauthn"` → Firefoxは `email webauthn` を認識しない
- `name="emailOrPhone"` → Firefoxは `username` 以外を認識しない
- `type="email"` → `type="password"` ではない

**どの発動条件も満たしていないため、FirefoxでPasskey Autofillが発動しない。**

## 発動に影響しない項目

| 項目 | 結果 |
|------|------|
| `inputmode` 属性 | 影響なし |
| `required` 属性 | 影響なし |
| `id` 属性 | 影響なし |
| `autocapitalize` / `autocorrect` 属性 | 影響なし |
| `placeholder` の内容 | 影響なし |

## 発動に必須の項目

| 項目 | Chrome | Firefox |
|------|--------|---------|
| inputが `<form>` 要素内にある | 不要 | **必須** |
| `autocomplete="... webauthn"` 属性 | 必須 | 必須 |
| `mediation: 'conditional'` での credentials.get 呼び出し | 必須 | 必須 |
| `allowCredentials` が空または未指定 | 必須 | 必須 |

## 複数inputがある場合の挙動

- ページ内に複数の `autocomplete="... webauthn"` を持つinputがある場合、**条件を満たすinputのみ**で発動する
- 複数のinputが条件を満たす場合でも、Firefoxは適切に処理する

## ブラウザ間の実装差異

| autocomplete値 | Chrome | Firefox |
|----------------|--------|---------|
| `username webauthn` | ✅ | ✅ |
| `email webauthn` | ✅ | ❌ |
| `webauthn` (単独) | ✅ | 条件付き |

Firefoxの実装はWebAuthn仕様の一部のみをサポートしており、`email webauthn` は未対応と思われる。

## 推奨事項

### Web開発者向け

1. **Firefox互換性を確保するには `autocomplete="username webauthn"` を使用する**
   - `email webauthn` はFirefoxで動作しない

2. **inputを `<form>` 要素内に配置する**
   - Firefoxではform外のinputでは発動しない

3. **`autocomplete="webauthn"` 単独を使う場合**
   - `type="password"` または `name="username"` を併用する

### メルカリへの修正提案

現在の実装:
```html
<input autocomplete="email webauthn" type="email" name="emailOrPhone">
```

修正案:
```html
<input autocomplete="username webauthn" type="email" name="emailOrPhone">
```

`autocomplete` 属性を `email webauthn` から `username webauthn` に変更することで、Firefoxでも発動するようになる。

## 調査日

2025年1月25日

## 参考リンク

- [MDN - autocomplete属性](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Attributes/autocomplete)
- [web.dev - Sign in with a passkey through form autofill](https://web.dev/articles/passkey-form-autofill)
- [Bugzilla #1934416](https://bugzilla.mozilla.org/show_bug.cgi?id=1934416) - Firefoxの `autocomplete="webauthn"` 実装に関するバグ報告
