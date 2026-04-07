# 訪問美容シフト管理アプリ セットアップ手順

## 所要時間: 約60〜90分（初回のみ）

---

## STEP 1: Supabaseでデータベースを作る（15分）

1. https://supabase.com にアクセスして無料アカウントを作成
2. 「New project」でプロジェクトを作成（名前は何でもOK）
3. 左メニューの「SQL Editor」を開く
4. `supabase/schema.sql` の内容をすべてコピーして貼り付け → 「Run」
5. 「Settings > API」を開いて以下の値をメモする:
   - Project URL → NEXT_PUBLIC_SUPABASE_URL
   - anon key     → NEXT_PUBLIC_SUPABASE_ANON_KEY
   - service_role key → SUPABASE_SERVICE_ROLE_KEY（眼のアイコンで表示）

---

## STEP 2: LINE Messaging APIを設定する（20分）

1. https://developers.line.biz にアクセスして「Messaging API」チャネルを作成
2. 「チャネル基本設定」で「チャネルアクセストークン（長期）」を発行 → LINE_CHANNEL_ACCESS_TOKEN としてメモ
3. 「Messaging API設定」で「応答メッセージ」を無効化（自動返信を消す）
4. Webhook URLは後でVercelのURLが決まってから設定（今はスキップ）

### スタッフのLINE User IDを取得する方法
1. Messaging API設定の「Webhook」を有効にする
2. スタッフに公式アカウントを友だち追加してもらう
3. スタッフがメッセージを送ると Webhookに`userId`が届く（一時的にログで確認）
4. Supabaseの staff テーブルに line_user_id を登録する:
   ```sql
   UPDATE staff SET line_user_id = 'Uxxxxxxxxxx' WHERE name = '田中 美咲';
   ```

---

## STEP 3: GitHubにコードをアップロードする（10分）

1. https://github.com で無料アカウントを作成
2. 「New repository」でリポジトリを作成
3. このフォルダ（shift-app）の内容をアップロード
   ```bash
   cd shift-app
   git init
   git add .
   git commit -m "first commit"
   git remote add origin https://github.com/あなたのユーザー名/shift-app.git
   git push -u origin main
   ```

---

## STEP 4: Vercelにデプロイする（15分）

1. https://vercel.com で無料アカウントを作成（GitHubでログイン可）
2. 「New Project」→ GitHubのリポジトリを選択
3. 「Environment Variables」に以下を入力:
   ```
   NEXT_PUBLIC_SUPABASE_URL       = （STEP1でメモした値）
   NEXT_PUBLIC_SUPABASE_ANON_KEY  = （STEP1でメモした値）
   SUPABASE_SERVICE_ROLE_KEY      = （STEP1でメモした値）
   LINE_CHANNEL_ACCESS_TOKEN      = （STEP2でメモした値）
   NEXT_PUBLIC_APP_URL            = https://あなたのapp.vercel.app（デプロイ後に更新）
   ADMIN_PASSWORD                 = （好きなパスワード）
   CRON_SECRET                    = （ランダムな文字列。例: abc123xyz）
   ```
4. 「Deploy」ボタンを押す
5. デプロイ完了後、表示されたURLをメモして NEXT_PUBLIC_APP_URL を更新

---

## STEP 5: 動作確認（10分）

1. `https://あなたのapp.vercel.app/admin` にアクセス
2. 設定したパスワードでログイン
3. 「スタッフ」タブでシフト確認URLを確認
4. 「シフト追加」でテストシフトを登録
5. スタッフ用URLをスマホで開いて「確認しました」ボタンをタップ
6. 管理者画面の「変更・未読確認」タブで既読が反映されることを確認

---

## アラート送信タイミング

毎朝日本時間 8:00 に自動実行されます:
- 5日前: シフトリマインド
- 3日前: シフトリマインド
- 前日:   シフトリマインド
- 当日:   当日アラート

変更時: 即時LINEに通知が届きます。

---

## よくある質問

**Q: スタッフのURLはいつ渡せばいい？**
A: 管理者画面の「スタッフ」タブに各自の個人URLがあります。LINEやメールで一度だけ送ってください。URLは変わりません。

**Q: LINE通知が届かない場合は？**
A: staff テーブルの line_user_id が正しいか確認してください。Vercelの「Functions」タブでログを確認できます。

**Q: 月1000通で足りる？**
A: スタッフ15名、月40回変更として 15×40 = 600通 + リマインド分 = 余裕で収まります。
