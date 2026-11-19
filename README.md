# Engineer's Desk
Offline Android study app for civil-engineering competitive exams (PPSC, FPSC, KPPSC, WAPDA): 14 subject handbooks, exam toolkit, MCQ practice, mock tests, revision mode and a 12-week study plan.

The app is a WebView shell (`app/`) around the content in `app/src/main/assets/www`. Every push to `main` builds a signed APK with GitHub Actions; changing `version.txt` (and `WHATSNEW.md`) publishes a new release, which the app's **Check for updates** picks up.
