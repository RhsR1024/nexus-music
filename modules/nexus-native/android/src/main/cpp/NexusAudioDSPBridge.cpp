// Original NexusMusic Android JNI bridge reusing shared C++20 AudioDSP.hpp.
#include <jni.h>
#include <array>
#include <cstdint>
#include <vector>
#include "AudioDSP.hpp"

namespace {
inline nexus::AudioDSP* fromHandle(jlong handle) {
  return reinterpret_cast<nexus::AudioDSP*>(handle);
}
}

extern "C" {

JNIEXPORT jlong JNICALL
Java_com_nexusmusic_nexusnative_NexusAudioDSP_nativeCreate(JNIEnv*, jobject) {
  return reinterpret_cast<jlong>(new nexus::AudioDSP());
}

JNIEXPORT void JNICALL
Java_com_nexusmusic_nexusnative_NexusAudioDSP_nativeDestroy(JNIEnv*, jobject, jlong handle) {
  delete fromHandle(handle);
}

JNIEXPORT void JNICALL
Java_com_nexusmusic_nexusnative_NexusAudioDSP_nativePrepare(
    JNIEnv*, jobject, jlong handle, jdouble sampleRate, jboolean floatingPoint) {
  if (auto* dsp = fromHandle(handle)) {
    dsp->prepare(sampleRate, floatingPoint == JNI_TRUE);
  }
}

JNIEXPORT void JNICALL
Java_com_nexusmusic_nexusnative_NexusAudioDSP_nativeConfigure(
    JNIEnv* env, jobject, jlong handle, jboolean enabled, jfloatArray gainsArray, jfloat preampDB) {
  auto* dsp = fromHandle(handle);
  if (!dsp) return;
  std::array<float, 10> gains{};
  if (gainsArray != nullptr) {
    jsize len = env->GetArrayLength(gainsArray);
    jsize count = len < 10 ? len : 10;
    env->GetFloatArrayRegion(gainsArray, 0, count, gains.data());
  }
  dsp->configure(enabled == JNI_TRUE, gains, preampDB);
}

JNIEXPORT void JNICALL
Java_com_nexusmusic_nexusnative_NexusAudioDSP_nativeProcessInterleaved(
    JNIEnv* env, jobject, jlong handle, jobject directBuffer, jint channelCount, jint frames) {
  auto* dsp = fromHandle(handle);
  if (!dsp || directBuffer == nullptr || channelCount <= 0 || channelCount > 8 || frames <= 0) return;
  auto* data = static_cast<float*>(env->GetDirectBufferAddress(directBuffer));
  jlong capacityBytes = env->GetDirectBufferCapacity(directBuffer);
  if (data == nullptr) return;
  const size_t requiredBytes = static_cast<size_t>(channelCount) * static_cast<size_t>(frames) * sizeof(float);
  if (capacityBytes < 0 || static_cast<size_t>(capacityBytes) < requiredBytes) return;

  float* channels[8] = {};
  uint32_t strides[8] = {};
  for (int ch = 0; ch < channelCount; ++ch) {
    channels[ch] = data + ch;
    strides[ch] = static_cast<uint32_t>(channelCount);
  }
  dsp->process(channels, strides, static_cast<uint32_t>(channelCount), static_cast<uint32_t>(frames));
}

JNIEXPORT jfloatArray JNICALL
Java_com_nexusmusic_nexusnative_NexusAudioDSP_nativeSpectrum(JNIEnv* env, jobject, jlong handle) {
  jfloatArray out = env->NewFloatArray(32);
  if (out == nullptr) return nullptr;
  auto* dsp = fromHandle(handle);
  if (!dsp) return out;
  auto bands = dsp->spectrum();
  env->SetFloatArrayRegion(out, 0, 32, bands.data());
  return out;
}

JNIEXPORT jfloat JNICALL
Java_com_nexusmusic_nexusnative_NexusAudioDSP_nativeHeadroomDB(JNIEnv*, jobject, jlong handle) {
  auto* dsp = fromHandle(handle);
  return dsp ? dsp->headroomDB() : 0.0f;
}

JNIEXPORT jboolean JNICALL
Java_com_nexusmusic_nexusnative_NexusAudioDSP_nativeSupported(JNIEnv*, jobject, jlong handle) {
  auto* dsp = fromHandle(handle);
  return (dsp && dsp->supported.load()) ? JNI_TRUE : JNI_FALSE;
}

}
