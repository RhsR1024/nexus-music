cmake_minimum_required(VERSION 3.22.1)
project(nexus_audio_dsp LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

add_library(nexus_audio_dsp SHARED
  NexusAudioDSPBridge.cpp
)

target_include_directories(nexus_audio_dsp PRIVATE
  ${CMAKE_CURRENT_SOURCE_DIR}/../../../../common
)

find_library(log-lib log)
target_link_libraries(nexus_audio_dsp ${log-lib})
