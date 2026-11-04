plugins {
    id("com.android.application")
}

android {
    namespace = "cl.girasindomito.hub.tv"
    compileSdk {
        version = release(36) {
            minorApiLevel = 1
        }
    }

    defaultConfig {
        applicationId = "cl.girasindomito.hub.tv"
        minSdk = 23
        targetSdk = 36
        versionCode = 3
        versionName = "1.1.1"
    }

    buildTypes {
        release {
            isMinifyEnabled = true
            proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro")
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
}
