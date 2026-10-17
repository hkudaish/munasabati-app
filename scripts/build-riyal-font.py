from fontTools.fontBuilder import FontBuilder
from fontTools.pens.ttGlyphPen import TTGlyphPen
from fontTools.pens.cu2quPen import Cu2QuPen
from fontTools.pens.transformPen import TransformPen
from fontTools.svgLib.path import SVGPath
from fontTools.ttLib import TTFont
font=FontBuilder(1000,isTTF=True)
font.setupGlyphOrder(['.notdef','riyal'])
empty=TTGlyphPen(None)
pen=TTGlyphPen(None)
SVGPath('public/fonts/saudi-riyal.svg').draw(TransformPen(Cu2QuPen(pen,1,reverse_direction=True),(0.6,0,0,-0.6,40,754)))
font.setupGlyf({'.notdef':empty.glyph(),'riyal':pen.glyph()})
font.setupHorizontalMetrics({'.notdef':(750,0),'riyal':(755,40)})
font.setupHorizontalHeader(ascent=850,descent=-150)
font.setupCharacterMap({0x20C1:'riyal'})
font.setupNameTable({'familyName':'Saudi Riyal','styleName':'Regular','uniqueFontIdentifier':'MunasabatiSaudiRiyal1','fullName':'Saudi Riyal','psName':'SaudiRiyal','version':'Version 1.0','description':'Official SAMA Saudi riyal symbol. Source: https://www.sama.gov.sa/ar-sa/Currency/Documents/Saudi_Riyal_Symbol-2.svg'})
font.setupOS2(sTypoAscender=850,sTypoDescender=-150,usWinAscent=850,usWinDescent=150)
font.setupPost()
font.save('public/fonts/saudi-riyal.ttf')
print('Generated single-glyph font from official SVG')
