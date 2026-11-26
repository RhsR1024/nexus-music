// Original NexusMusic Android QuickJS-ng JNI bridge for isolated LX script runtimes.
// Each instance owns an isolated JSRuntime + JSContext with bounded memory/stack and
// cooperative interrupt support. No filesystem or app credentials are exposed.
#include <jni.h>
#include <atomic>
#include <cstdint>
#include <cstring>
#include <string>

extern "C" {
#include "quickjs.h"
}

namespace {

struct QuickJSInstance {
  JavaVM* jvm = nullptr;
  jobject hostGlobalRef = nullptr;
  jmethodID onEmit = nullptr;
  jmethodID onHttp = nullptr;
  jmethodID onAbortHttp = nullptr;
  jmethodID onTimer = nullptr;
  jmethodID onClearTimer = nullptr;
  jmethodID onUtility = nullptr;
  JSRuntime* rt = nullptr;
  JSContext* ctx = nullptr;
  std::atomic<bool> interrupted{false};
};

JNIEnv* getEnv(JavaVM* jvm) {
  JNIEnv* env = nullptr;
  if (!jvm) return nullptr;
  if (jvm->GetEnv(reinterpret_cast<void**>(&env), JNI_VERSION_1_6) == JNI_OK) {
    return env;
  }
  return nullptr;
}

int interruptHandler(JSContext*, void* opaque) {
  auto* inst = static_cast<QuickJSInstance*>(opaque);
  return (inst && inst->interrupted.load(std::memory_order_acquire)) ? 1 : 0;
}

std::string toStdString(JSContext* ctx, JSValueConst val) {
  size_t len = 0;
  const char* str = JS_ToCStringLen(ctx, &len, val);
  if (!str) return "";
  std::string out(str, len);
  JS_FreeCString(ctx, str);
  return out;
}

JSValue jsHostEmit(JSContext* ctx, JSValueConst, int argc, JSValueConst* argv) {
  auto* inst = static_cast<QuickJSInstance*>(JS_GetContextOpaque(ctx));
  if (!inst || argc < 2) return JS_UNDEFINED;
  JNIEnv* env = getEnv(inst->jvm);
  if (!env) return JS_UNDEFINED;
  std::string event = toStdString(ctx, argv[0]);
  std::string json = toStdString(ctx, argv[1]);
  jstring jEvent = env->NewStringUTF(event.c_str());
  jstring jJson = env->NewStringUTF(json.c_str());
  env->CallVoidMethod(inst->hostGlobalRef, inst->onEmit, jEvent, jJson);
  env->DeleteLocalRef(jEvent);
  env->DeleteLocalRef(jJson);
  if (env->ExceptionCheck()) env->ExceptionClear();
  return JS_UNDEFINED;
}

JSValue jsHostHttp(JSContext* ctx, JSValueConst, int argc, JSValueConst* argv) {
  auto* inst = static_cast<QuickJSInstance*>(JS_GetContextOpaque(ctx));
  if (!inst || argc < 3) return JS_UNDEFINED;
  JNIEnv* env = getEnv(inst->jvm);
  if (!env) return JS_UNDEFINED;
  int32_t id = 0;
  JS_ToInt32(ctx, &id, argv[0]);
  std::string url = toStdString(ctx, argv[1]);
  std::string opts = toStdString(ctx, argv[2]);
  jstring jUrl = env->NewStringUTF(url.c_str());
  jstring jOpts = env->NewStringUTF(opts.c_str());
  env->CallVoidMethod(inst->hostGlobalRef, inst->onHttp, static_cast<jint>(id), jUrl, jOpts);
  env->DeleteLocalRef(jUrl);
  env->DeleteLocalRef(jOpts);
  if (env->ExceptionCheck()) env->ExceptionClear();
  return JS_UNDEFINED;
}

JSValue jsHostAbortHttp(JSContext* ctx, JSValueConst, int argc, JSValueConst* argv) {
  auto* inst = static_cast<QuickJSInstance*>(JS_GetContextOpaque(ctx));
  if (!inst || argc < 1) return JS_UNDEFINED;
  JNIEnv* env = getEnv(inst->jvm);
  if (!env) return JS_UNDEFINED;
  int32_t id = 0;
  JS_ToInt32(ctx, &id, argv[0]);
  env->CallVoidMethod(inst->hostGlobalRef, inst->onAbortHttp, static_cast<jint>(id));
  if (env->ExceptionCheck()) env->ExceptionClear();
  return JS_UNDEFINED;
}

JSValue jsHostTimer(JSContext* ctx, JSValueConst, int argc, JSValueConst* argv) {
  auto* inst = static_cast<QuickJSInstance*>(JS_GetContextOpaque(ctx));
  if (!inst || argc < 2) return JS_UNDEFINED;
  JNIEnv* env = getEnv(inst->jvm);
  if (!env) return JS_UNDEFINED;
  int32_t id = 0;
  double delay = 0;
  JS_ToInt32(ctx, &id, argv[0]);
  JS_ToFloat64(ctx, &delay, argv[1]);
  env->CallVoidMethod(inst->hostGlobalRef, inst->onTimer, static_cast<jint>(id), static_cast<jdouble>(delay));
  if (env->ExceptionCheck()) env->ExceptionClear();
  return JS_UNDEFINED;
}

JSValue jsHostClearTimer(JSContext* ctx, JSValueConst, int argc, JSValueConst* argv) {
  auto* inst = static_cast<QuickJSInstance*>(JS_GetContextOpaque(ctx));
  if (!inst || argc < 1) return JS_UNDEFINED;
  JNIEnv* env = getEnv(inst->jvm);
  if (!env) return JS_UNDEFINED;
  int32_t id = 0;
  JS_ToInt32(ctx, &id, argv[0]);
  env->CallVoidMethod(inst->hostGlobalRef, inst->onClearTimer, static_cast<jint>(id));
  if (env->ExceptionCheck()) env->ExceptionClear();
  return JS_UNDEFINED;
}

JSValue jsHostUtility(JSContext* ctx, JSValueConst, int argc, JSValueConst* argv) {
  auto* inst = static_cast<QuickJSInstance*>(JS_GetContextOpaque(ctx));
  if (!inst || argc < 2) return JS_NewString(ctx, "{\"error\":\"Invalid utility call\"}");
  JNIEnv* env = getEnv(inst->jvm);
  if (!env) return JS_NewString(ctx, "{\"error\":\"No JNI env\"}");
  std::string op = toStdString(ctx, argv[0]);
  std::string json = toStdString(ctx, argv[1]);
  jstring jOp = env->NewStringUTF(op.c_str());
  jstring jJson = env->NewStringUTF(json.c_str());
  auto jResult = static_cast<jstring>(env->CallObjectMethod(inst->hostGlobalRef, inst->onUtility, jOp, jJson));
  env->DeleteLocalRef(jOp);
  env->DeleteLocalRef(jJson);
  if (env->ExceptionCheck()) {
    env->ExceptionClear();
    if (jResult) env->DeleteLocalRef(jResult);
    return JS_NewString(ctx, "{\"error\":\"Utility threw\"}");
  }
  if (!jResult) {
    return JS_NewString(ctx, "{\"error\":\"Null utility result\"}");
  }
  const char* chars = env->GetStringUTFChars(jResult, nullptr);
  JSValue out = JS_NewString(ctx, chars ? chars : "{\"error\":\"Empty\"}");
  if (chars) env->ReleaseStringUTFChars(jResult, chars);
  env->DeleteLocalRef(jResult);
  return out;
}

bool drainPendingJobs(QuickJSInstance* inst) {
  JSContext* jobCtx = nullptr;
  int guard = 0;
  while (!inst->interrupted.load(std::memory_order_acquire) && guard++ < 4096) {
    int rc = JS_ExecutePendingJob(inst->rt, &jobCtx);
    if (rc < 0) {
      JSValue ex = JS_GetException(jobCtx ? jobCtx : inst->ctx);
      JS_FreeValue(jobCtx ? jobCtx : inst->ctx, ex);
      return false;
    }
    if (rc == 0) break;
  }
  return !inst->interrupted.load(std::memory_order_acquire);
}

inline QuickJSInstance* fromHandle(jlong handle) {
  return reinterpret_cast<QuickJSInstance*>(handle);
}

}  // namespace

extern "C" {

JNIEXPORT jlong JNICALL
Java_com_nexusmusic_nexusnative_NexusQuickJS_nativeCreate(JNIEnv* env, jobject, jobject hostBridge) {
  auto* inst = new QuickJSInstance();
  env->GetJavaVM(&inst->jvm);
  inst->hostGlobalRef = env->NewGlobalRef(hostBridge);
  jclass cls = env->GetObjectClass(hostBridge);
  inst->onEmit = env->GetMethodID(cls, "onEmit", "(Ljava/lang/String;Ljava/lang/String;)V");
  inst->onHttp = env->GetMethodID(cls, "onHttp", "(ILjava/lang/String;Ljava/lang/String;)V");
  inst->onAbortHttp = env->GetMethodID(cls, "onAbortHttp", "(I)V");
  inst->onTimer = env->GetMethodID(cls, "onTimer", "(ID)V");
  inst->onClearTimer = env->GetMethodID(cls, "onClearTimer", "(I)V");
  inst->onUtility = env->GetMethodID(cls, "onUtility", "(Ljava/lang/String;Ljava/lang/String;)Ljava/lang/String;");
  env->DeleteLocalRef(cls);

  inst->rt = JS_NewRuntime();
  if (!inst->rt) {
    env->DeleteGlobalRef(inst->hostGlobalRef);
    delete inst;
    return 0;
  }
  JS_SetMemoryLimit(inst->rt, 32 * 1024 * 1024);
  JS_SetMaxStackSize(inst->rt, 1024 * 1024);
  JS_SetInterruptHandler(inst->rt, interruptHandler, inst);

  inst->ctx = JS_NewContext(inst->rt);
  if (!inst->ctx) {
    JS_FreeRuntime(inst->rt);
    env->DeleteGlobalRef(inst->hostGlobalRef);
    delete inst;
    return 0;
  }
  JS_SetContextOpaque(inst->ctx, inst);

  JSValue global = JS_GetGlobalObject(inst->ctx);
  JSValue nativeObj = JS_NewObject(inst->ctx);
  JS_SetPropertyStr(inst->ctx, nativeObj, "emit", JS_NewCFunction(inst->ctx, jsHostEmit, "emit", 2));
  JS_SetPropertyStr(inst->ctx, nativeObj, "http", JS_NewCFunction(inst->ctx, jsHostHttp, "http", 3));
  JS_SetPropertyStr(inst->ctx, nativeObj, "abortHttp", JS_NewCFunction(inst->ctx, jsHostAbortHttp, "abortHttp", 1));
  JS_SetPropertyStr(inst->ctx, nativeObj, "timer", JS_NewCFunction(inst->ctx, jsHostTimer, "timer", 2));
  JS_SetPropertyStr(inst->ctx, nativeObj, "clearTimer", JS_NewCFunction(inst->ctx, jsHostClearTimer, "clearTimer", 1));
  JS_SetPropertyStr(inst->ctx, nativeObj, "utility", JS_NewCFunction(inst->ctx, jsHostUtility, "utility", 2));
  JS_SetPropertyStr(inst->ctx, global, "__nexusNative", nativeObj);
  JS_FreeValue(inst->ctx, global);

  return reinterpret_cast<jlong>(inst);
}

JNIEXPORT jboolean JNICALL
Java_com_nexusmusic_nexusnative_NexusQuickJS_nativeSetScriptInfo(
    JNIEnv* env, jobject, jlong handle, jstring infoJson) {
  auto* inst = fromHandle(handle);
  if (!inst || !inst->ctx || !infoJson) return JNI_FALSE;
  const char* chars = env->GetStringUTFChars(infoJson, nullptr);
  if (!chars) return JNI_FALSE;
  size_t len = strlen(chars);
  JSValue parsed = JS_ParseJSON(inst->ctx, chars, len, "<scriptInfo>");
  env->ReleaseStringUTFChars(infoJson, chars);
  if (JS_IsException(parsed)) {
    JSValue ex = JS_GetException(inst->ctx);
    JS_FreeValue(inst->ctx, ex);
    return JNI_FALSE;
  }
  JSValue global = JS_GetGlobalObject(inst->ctx);
  JS_SetPropertyStr(inst->ctx, global, "__nexusScriptInfo", parsed);
  JS_FreeValue(inst->ctx, global);
  return JNI_TRUE;
}

JNIEXPORT jboolean JNICALL
Java_com_nexusmusic_nexusnative_NexusQuickJS_nativeEvaluate(
    JNIEnv* env, jobject, jlong handle, jstring code, jstring filename) {
  auto* inst = fromHandle(handle);
  if (!inst || !inst->ctx || !code || !filename) return JNI_FALSE;
  const char* codeChars = env->GetStringUTFChars(code, nullptr);
  const char* fileChars = env->GetStringUTFChars(filename, nullptr);
  if (!codeChars || !fileChars) {
    if (codeChars) env->ReleaseStringUTFChars(code, codeChars);
    if (fileChars) env->ReleaseStringUTFChars(filename, fileChars);
    return JNI_FALSE;
  }
  JSValue val = JS_Eval(inst->ctx, codeChars, strlen(codeChars), fileChars, JS_EVAL_TYPE_GLOBAL);
  env->ReleaseStringUTFChars(code, codeChars);
  env->ReleaseStringUTFChars(filename, fileChars);
  if (JS_IsException(val)) {
    JSValue ex = JS_GetException(inst->ctx);
    JS_FreeValue(inst->ctx, ex);
    return JNI_FALSE;
  }
  JS_FreeValue(inst->ctx, val);
  return drainPendingJobs(inst) ? JNI_TRUE : JNI_FALSE;
}

JNIEXPORT jboolean JNICALL
Java_com_nexusmusic_nexusnative_NexusQuickJS_nativeCallTimer(
    JNIEnv*, jobject, jlong handle, jint id) {
  auto* inst = fromHandle(handle);
  if (!inst || !inst->ctx) return JNI_FALSE;
  JSValue global = JS_GetGlobalObject(inst->ctx);
  JSValue fn = JS_GetPropertyStr(inst->ctx, global, "__nexusTimer");
  if (!JS_IsFunction(inst->ctx, fn)) {
    JS_FreeValue(inst->ctx, fn);
    JS_FreeValue(inst->ctx, global);
    return JNI_TRUE;
  }
  JSValue arg = JS_NewInt32(inst->ctx, id);
  JSValue res = JS_Call(inst->ctx, fn, global, 1, &arg);
  JS_FreeValue(inst->ctx, arg);
  JS_FreeValue(inst->ctx, fn);
  JS_FreeValue(inst->ctx, global);
  if (JS_IsException(res)) {
    JSValue ex = JS_GetException(inst->ctx);
    JS_FreeValue(inst->ctx, ex);
    return JNI_FALSE;
  }
  JS_FreeValue(inst->ctx, res);
  return drainPendingJobs(inst) ? JNI_TRUE : JNI_FALSE;
}

JNIEXPORT jboolean JNICALL
Java_com_nexusmusic_nexusnative_NexusQuickJS_nativeCallHttp(
    JNIEnv* env, jobject, jlong handle, jint id, jstring errorOrNull, jstring responseJsonOrNull) {
  auto* inst = fromHandle(handle);
  if (!inst || !inst->ctx) return JNI_FALSE;
  JSValue global = JS_GetGlobalObject(inst->ctx);
  JSValue fn = JS_GetPropertyStr(inst->ctx, global, "__nexusHttp");
  if (!JS_IsFunction(inst->ctx, fn)) {
    JS_FreeValue(inst->ctx, fn);
    JS_FreeValue(inst->ctx, global);
    return JNI_TRUE;
  }
  JSValue args[3];
  args[0] = JS_NewInt32(inst->ctx, id);
  if (errorOrNull) {
    const char* err = env->GetStringUTFChars(errorOrNull, nullptr);
    args[1] = JS_NewString(inst->ctx, err ? err : "HTTP_REQUEST_FAILED");
    if (err) env->ReleaseStringUTFChars(errorOrNull, err);
  } else {
    args[1] = JS_NULL;
  }
  if (responseJsonOrNull) {
    const char* resp = env->GetStringUTFChars(responseJsonOrNull, nullptr);
    args[2] = resp ? JS_ParseJSON(inst->ctx, resp, strlen(resp), "<http>") : JS_NULL;
    if (resp) env->ReleaseStringUTFChars(responseJsonOrNull, resp);
    if (JS_IsException(args[2])) {
      JSValue ex = JS_GetException(inst->ctx);
      JS_FreeValue(inst->ctx, ex);
      args[2] = JS_NULL;
    }
  } else {
    args[2] = JS_NULL;
  }

  JSValue res = JS_Call(inst->ctx, fn, global, 3, args);
  JS_FreeValue(inst->ctx, args[0]);
  JS_FreeValue(inst->ctx, args[1]);
  JS_FreeValue(inst->ctx, args[2]);
  JS_FreeValue(inst->ctx, fn);
  JS_FreeValue(inst->ctx, global);
  if (JS_IsException(res)) {
    JSValue ex = JS_GetException(inst->ctx);
    JS_FreeValue(inst->ctx, ex);
    return JNI_FALSE;
  }
  JS_FreeValue(inst->ctx, res);
  return drainPendingJobs(inst) ? JNI_TRUE : JNI_FALSE;
}

JNIEXPORT jboolean JNICALL
Java_com_nexusmusic_nexusnative_NexusQuickJS_nativeCallInvoke(
    JNIEnv* env, jobject, jlong handle, jstring reqId, jstring payloadJson) {
  auto* inst = fromHandle(handle);
  if (!inst || !inst->ctx || !reqId || !payloadJson) return JNI_FALSE;
  JSValue global = JS_GetGlobalObject(inst->ctx);
  JSValue fn = JS_GetPropertyStr(inst->ctx, global, "__nexusInvoke");
  if (!JS_IsFunction(inst->ctx, fn)) {
    JS_FreeValue(inst->ctx, fn);
    JS_FreeValue(inst->ctx, global);
    return JNI_FALSE;
  }
  const char* idChars = env->GetStringUTFChars(reqId, nullptr);
  const char* payloadChars = env->GetStringUTFChars(payloadJson, nullptr);
  JSValue args[2];
  args[0] = JS_NewString(inst->ctx, idChars ? idChars : "");
  args[1] = payloadChars ? JS_ParseJSON(inst->ctx, payloadChars, strlen(payloadChars), "<payload>") : JS_NULL;
  if (idChars) env->ReleaseStringUTFChars(reqId, idChars);
  if (payloadChars) env->ReleaseStringUTFChars(payloadJson, payloadChars);
  if (JS_IsException(args[1])) {
    JSValue ex = JS_GetException(inst->ctx);
    JS_FreeValue(inst->ctx, ex);
    JS_FreeValue(inst->ctx, args[0]);
    JS_FreeValue(inst->ctx, fn);
    JS_FreeValue(inst->ctx, global);
    return JNI_FALSE;
  }
  JSValue res = JS_Call(inst->ctx, fn, global, 2, args);
  JS_FreeValue(inst->ctx, args[0]);
  JS_FreeValue(inst->ctx, args[1]);
  JS_FreeValue(inst->ctx, fn);
  JS_FreeValue(inst->ctx, global);
  if (JS_IsException(res)) {
    JSValue ex = JS_GetException(inst->ctx);
    JS_FreeValue(inst->ctx, ex);
    return JNI_FALSE;
  }
  JS_FreeValue(inst->ctx, res);
  return drainPendingJobs(inst) ? JNI_TRUE : JNI_FALSE;
}

JNIEXPORT void JNICALL
Java_com_nexusmusic_nexusnative_NexusQuickJS_nativeInterrupt(JNIEnv*, jobject, jlong handle) {
  if (auto* inst = fromHandle(handle)) {
    inst->interrupted.store(true, std::memory_order_release);
  }
}

JNIEXPORT void JNICALL
Java_com_nexusmusic_nexusnative_NexusQuickJS_nativeDestroy(JNIEnv* env, jobject, jlong handle) {
  auto* inst = fromHandle(handle);
  if (!inst) return;
  inst->interrupted.store(true, std::memory_order_release);
  if (inst->ctx) {
    JS_FreeContext(inst->ctx);
    inst->ctx = nullptr;
  }
  if (inst->rt) {
    JS_FreeRuntime(inst->rt);
    inst->rt = nullptr;
  }
  if (inst->hostGlobalRef) {
    env->DeleteGlobalRef(inst->hostGlobalRef);
    inst->hostGlobalRef = nullptr;
  }
  delete inst;
}

}
