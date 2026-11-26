cmake_minimum_required(VERSION 3.22.1)
project(nexus_native_cpp LANGUAGES C CXX)

set(CMAKE_C_STANDARD 11)
set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

# 1. Shared C++20 AudioDSP engine (10-band biquad EQ + headroom + 32-band FFT)
add_library(nexus_audio_dsp SHARED
  NexusAudioDSPBridge.cpp
)

target_include_directories(nexus_audio_dsp PRIVATE
  ${CMAKE_CURRENT_SOURCE_DIR}/../../../../common
)

find_library(log-lib log)
target_link_libraries(nexus_audio_dsp ${log-lib})
target_link_options(nexus_audio_dsp PRIVATE "-Wl,-z,max-page-size=16384")

# 2. Isolated QuickJS-ng v0.18.0 engine for Android LX script host (MIT)
add_library(nexus_quickjs SHARED
  NexusQuickJSBridge.cpp
  quickjs/quickjs.c
  quickjs/dtoa.c
  quickjs/libregexp.c
  quickjs/libunicode.c
)

target_include_directories(nexus_quickjs PRIVATE
  ${CMAKE_CURRENT_SOURCE_DIR}/quickjs
)

target_compile_definitions(nexus_quickjs PRIVATE
  _GNU_SOURCE
  CONFIG_VERSION="0.18.0"
)

target_compile_options(nexus_quickjs PRIVATE
  -Wno-sign-compare
  -Wno-unused-parameter
  -Wno-missing-field-initializers
)

target_link_libraries(nexus_quickjs ${log-lib} m)
target_link_options(nexus_quickjs PRIVATE "-Wl,-z,max-page-size=16384")
