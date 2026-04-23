#!/usr/bin/env swift

import AppKit
import CoreText
import Foundation

struct Entry: Decodable {
  let voz: String
  let significado: String
}

struct Config {
  let inputURL: URL
  let outputURL: URL
  let title: String
  let locale: String
}

let config = try parseArguments()
let entries = try loadEntries(from: config.inputURL, locale: config.locale)
try registerFontIfPresent(named: "DejaVuLGCSerif.ttf", relativeTo: config.inputURL)

let pdfData = NSMutableData()
var mediaBox = CGRect(x: 0, y: 0, width: 595.28, height: 841.89) // A4

guard let consumer = CGDataConsumer(data: pdfData as CFMutableData),
      let context = CGContext(consumer: consumer, mediaBox: &mediaBox, nil) else {
  fatalError("Non se puido crear o contexto PDF.")
}

let layout = PageLayout(pageRect: mediaBox)
let attributed = composeDocument(entries: entries, title: config.title, layout: layout)
render(document: attributed, into: context, layout: layout)
context.closePDF()

try pdfData.write(to: config.outputURL, options: .atomic)
print("PDF xerado en \(config.outputURL.path)")

struct PageLayout {
  let pageRect: CGRect
  let marginX: CGFloat = 34
  let marginTop: CGFloat = 30
  let marginBottom: CGFloat = 26
  let columnGap: CGFloat = 18
  let headerHeight: CGFloat = 14
  let footerHeight: CGFloat = 10

  var contentRect: CGRect {
    CGRect(
      x: marginX,
      y: marginBottom + footerHeight,
      width: pageRect.width - (marginX * 2),
      height: pageRect.height - marginTop - marginBottom - headerHeight - footerHeight
    )
  }

  var columnWidth: CGFloat {
    (contentRect.width - columnGap) / 2
  }

  var columnHeight: CGFloat {
    contentRect.height
  }

  func columnRect(index: Int) -> CGRect {
    CGRect(
      x: contentRect.minX + CGFloat(index) * (columnWidth + columnGap),
      y: contentRect.minY,
      width: columnWidth,
      height: columnHeight
    )
  }
}

func parseArguments() throws -> Config {
  let args = Array(CommandLine.arguments.dropFirst())
  guard args.count == 4 else {
    throw NSError(
      domain: "generate_vocab_pdf",
      code: 1,
      userInfo: [NSLocalizedDescriptionKey: "Uso: swift generate_vocab_pdf.swift <input.json> <output.pdf> <title> <locale>"]
    )
  }

  let cwd = URL(fileURLWithPath: FileManager.default.currentDirectoryPath)
  return Config(
    inputURL: url(from: args[0], cwd: cwd),
    outputURL: url(from: args[1], cwd: cwd),
    title: args[2],
    locale: args[3]
  )
}

func url(from path: String, cwd: URL) -> URL {
  let url = URL(fileURLWithPath: path, relativeTo: cwd)
  return url.standardizedFileURL
}

func loadEntries(from url: URL, locale: String) throws -> [Entry] {
  let data = try Data(contentsOf: url)
  var entries = try JSONDecoder().decode([Entry].self, from: data)
  entries.sort {
    normalize($0.voz).localizedCompare(normalize($1.voz), locale: locale) == .orderedAscending
  }
  return entries
}

func normalize(_ text: String) -> String {
  text
    .folding(options: [.diacriticInsensitive, .caseInsensitive], locale: Locale(identifier: "gl"))
    .replacingOccurrences(of: "ς", with: "σ")
}

extension String {
  func localizedCompare(_ other: String, locale: String) -> ComparisonResult {
    compare(other, options: [.caseInsensitive, .diacriticInsensitive], range: nil, locale: Locale(identifier: locale))
  }
}

func registerFontIfPresent(named name: String, relativeTo inputURL: URL) throws {
  let candidate = inputURL.deletingLastPathComponent()
    .deletingLastPathComponent()
    .deletingLastPathComponent()
    .appendingPathComponent("fonts")
    .appendingPathComponent(name)

  guard FileManager.default.fileExists(atPath: candidate.path) else { return }
  CTFontManagerRegisterFontsForURL(candidate as CFURL, .process, nil)
}

func composeDocument(entries: [Entry], title: String, layout: PageLayout) -> NSAttributedString {
  let result = NSMutableAttributedString()

  let bodyFont = resolvedFont(preferred: "DejaVu Serif", fallback: "Times New Roman", size: 8.0)
  let boldFont = resolvedFont(preferred: "Times New Roman Bold", fallback: "Times-Bold", size: 8.1)
  let titleFont = resolvedFont(preferred: "Times New Roman Bold", fallback: "Times-Bold", size: 10.0)

  let titleStyle = NSMutableParagraphStyle()
  titleStyle.alignment = .center
  titleStyle.paragraphSpacing = 8

  result.append(NSAttributedString(
    string: "\(title)\n",
    attributes: [
      .font: titleFont,
      .paragraphStyle: titleStyle
    ]
  ))

  let bodyStyle = NSMutableParagraphStyle()
  bodyStyle.lineSpacing = 0.15
  bodyStyle.paragraphSpacing = 1.1
  bodyStyle.hyphenationFactor = 0.0
  bodyStyle.lineBreakMode = .byWordWrapping

  let subStyle = bodyStyle.mutableCopy() as! NSMutableParagraphStyle
  subStyle.headIndent = 10
  subStyle.firstLineHeadIndent = 10

  for entry in entries {
    let parts = parseMeaning(entry.significado)
    let line = NSMutableAttributedString(
      string: entry.voz,
      attributes: [.font: boldFont, .paragraphStyle: bodyStyle]
    )
    line.append(NSAttributedString(
      string: ": \(parts.main)\n",
      attributes: [.font: bodyFont, .paragraphStyle: bodyStyle]
    ))
    result.append(line)

    for (index, sub) in parts.subs.enumerated() {
      let bullet = "\(index + 1). "
      let subLine = NSMutableAttributedString(
        string: bullet,
        attributes: [.font: bodyFont, .paragraphStyle: subStyle]
      )

      if let colon = sub.firstIndex(of: ":") {
        let left = String(sub[..<colon])
        let right = String(sub[sub.index(after: colon)...])
        subLine.append(NSAttributedString(
          string: left,
          attributes: [.font: boldFont, .paragraphStyle: subStyle]
        ))
        subLine.append(NSAttributedString(
          string: ":\(right)\n",
          attributes: [.font: bodyFont, .paragraphStyle: subStyle]
        ))
      } else {
        subLine.append(NSAttributedString(
          string: "\(sub)\n",
          attributes: [.font: bodyFont, .paragraphStyle: subStyle]
        ))
      }

      result.append(subLine)
    }
  }

  return result
}

func parseMeaning(_ text: String) -> (main: String, subs: [String]) {
  var main: [String] = []
  var subs: [String] = []

  for rawLine in text.components(separatedBy: .newlines) {
    let line = rawLine.trimmingCharacters(in: .whitespacesAndNewlines)
    if line.isEmpty { continue }

    if line.range(of: #"^\d+\."#, options: .regularExpression) != nil {
      let cleaned = line.replacingOccurrences(of: #"^\d+\.\s*"#, with: "", options: .regularExpression)
      subs.append(cleaned)
    } else {
      main.append(line)
    }
  }

  return (main.joined(separator: " "), subs)
}

func render(document: NSAttributedString, into context: CGContext, layout: PageLayout) {
  let framesetter = CTFramesetterCreateWithAttributedString(document as CFAttributedString)
  var position = 0
  var pageNumber = 1

  while position < document.length {
    context.beginPDFPage(nil)
    drawPageNumber(pageNumber, in: context, layout: layout)

    context.saveGState()
    context.textMatrix = .identity

    for columnIndex in 0..<2 {
      if position >= document.length { break }

      let rect = layout.columnRect(index: columnIndex)
      let path = CGMutablePath()
      path.addRect(rect)

      let frame = CTFramesetterCreateFrame(
        framesetter,
        CFRange(location: position, length: 0),
        path,
        nil
      )

      CTFrameDraw(frame, context)
      let visible = CTFrameGetVisibleStringRange(frame)
      position += visible.length
    }

    context.restoreGState()
    context.endPDFPage()
    pageNumber += 1
  }
}

func drawPageNumber(_ page: Int, in context: CGContext, layout: PageLayout) {
  let font = resolvedFont(preferred: "Times New Roman", fallback: "Times-Roman", size: 7)
  let attrs: [NSAttributedString.Key: Any] = [
    .font: font,
    .foregroundColor: NSColor.black.withAlphaComponent(0.7)
  ]
  let text = NSAttributedString(string: "\(page)", attributes: attrs)
  let size = text.size()
  let point = CGPoint(
    x: layout.pageRect.midX - (size.width / 2),
    y: layout.marginBottom / 2
  )
  text.draw(at: point)
}

func resolvedFont(preferred: String, fallback: String, size: CGFloat) -> NSFont {
  NSFont(name: preferred, size: size)
    ?? NSFont(name: fallback, size: size)
    ?? NSFont.systemFont(ofSize: size)
}
