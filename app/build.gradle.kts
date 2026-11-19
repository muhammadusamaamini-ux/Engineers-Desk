plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}
val appVersion = rootProject.file("version.txt").readText().trim()
val code = (project.findProperty("versionCode") as String?)?.toInt() ?: 1
android {
    namespace = "pk.engineersdesk"
    compileSdk = 34
    defaultConfig {
        applicationId = "pk.engineersdesk"
        minSdk = 24
        targetSdk = 34
        versionCode = code
        versionName = appVersion
    }
    signingConfigs {
        create("release") {
            storeFile = rootProject.file("signing/release.jks")
            storePassword = "EdDesk2026!ks"
            keyAlias = "engineersdesk"
            keyPassword = "EdDesk2026!ks"
        }
    }
    buildTypes {
        release {
            isMinifyEnabled = false
            signingConfig = signingConfigs.getByName("release")
        }
    }
    compileOptions { sourceCompatibility = JavaVersion.VERSION_17; targetCompatibility = JavaVersion.VERSION_17 }
    kotlinOptions { jvmTarget = "17" }
    buildFeatures { buildConfig = true }
    androidResources { noCompress += listOf("json", "webp") }
}
dependencies {
    implementation("androidx.core:core-ktx:1.13.1")
    implementation("androidx.appcompat:appcompat:1.7.0")
    implementation("androidx.webkit:webkit:1.11.0")
    implementation("androidx.work:work-runtime-ktx:2.9.1")
}
