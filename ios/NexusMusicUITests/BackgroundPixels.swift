import Foundation
import CoreGraphics
import ImageIO

// Test-only sampling in an explicit sRGB/RGBA8 buffer. The caller supplies
// physical screenshot pixels, independent of an application's AX frame.
enum BackgroundPixels {
  static func decode(_ data: Data) -> CGImage? {
    guard let source = CGImageSourceCreateWithData(data as CFData, nil) else { return nil }
    return CGImageSourceCreateImageAtIndex(source, 0, nil)
  }
  static func rgba(_ image: CGImage, at point: CGPoint) -> [UInt8] {
    guard point.x.isFinite, point.y.isFinite, point.x >= 0, point.y >= 0,
      point.x < CGFloat(image.width), point.y < CGFloat(image.height),
      let pixel = image.cropping(to: CGRect(x: floor(point.x), y: floor(point.y), width: 1, height: 1)) else { return [] }
    var bytes = [UInt8](repeating: 0, count: 4)
    let sampled = bytes.withUnsafeMutableBytes { memory -> Bool in
      guard let context = CGContext(data: memory.baseAddress, width: 1, height: 1, bitsPerComponent: 8, bytesPerRow: 4,
        space: CGColorSpace(name: CGColorSpace.sRGB)!,
        bitmapInfo: CGBitmapInfo.byteOrder32Big.rawValue | CGImageAlphaInfo.premultipliedLast.rawValue) else { return false }
      context.draw(pixel, in: CGRect(x: 0, y: 0, width: 1, height: 1)); return true
    }
    return sampled ? bytes : []
  }
  static func greenBounds(_ image: CGImage) -> CGRect? {
    let width=image.width,height=image.height
    guard width>0 && height>0 && width<=8192 && height<=8192 && width*height<=40_000_000 else{return nil}
    var bytes=[UInt8](repeating:0,count:width*height*4)
    let rendered=bytes.withUnsafeMutableBytes { memory -> Bool in
      guard let context=CGContext(data:memory.baseAddress,width:width,height:height,bitsPerComponent:8,bytesPerRow:width*4,space:CGColorSpace(name:CGColorSpace.sRGB)!,bitmapInfo:CGBitmapInfo.byteOrder32Big.rawValue|CGImageAlphaInfo.premultipliedLast.rawValue) else{return false}
      context.draw(image,in:CGRect(x:0,y:0,width:width,height:height));return true
    }
    guard rendered else{return nil}
    var minX=width,minY=height,maxX = -1,maxY = -1
    for y in 0..<height {for x in 0..<width {
      let i=(y*width+x)*4,r=Int(bytes[i]),g=Int(bytes[i+1]),b=Int(bytes[i+2])
      if bytes[i+3]==255 && g>30 && g>r+30 && g>b+30 {minX=min(minX,x);minY=min(minY,y);maxX=max(maxX,x);maxY=max(maxY,y)}
    }}
    guard maxX>=minX && maxY>=minY else{return nil}
    return CGRect(x:minX,y:minY,width:maxX-minX+1,height:maxY-minY+1)
  }
  static func hasPrimaryHues(_ samples: [[UInt8]]) -> Bool {
    var hues = Set<Int>()
    for rgba in samples {
      guard rgba.count == 4, rgba[3] == 255 else { continue }
      let ranked = [0, 1, 2].sorted { rgba[$0] > rgba[$1] }
      if Int(rgba[ranked[0]]) - Int(rgba[ranked[1]]) >= 2 && Int(rgba[ranked[0]]) - Int(rgba[ranked[2]]) >= 6 { hues.insert(ranked[0]) }
    }
    return hues.isSuperset(of: [0, 1, 2])
  }
}
