function median (data) {
  var mdarr = data.slice(0)
  mdarr.sort(function (a, b) { return a - b })

  if (mdarr.length % 2 === 0) {
    return (mdarr[mdarr.length / 2 - 1] + mdarr[mdarr.length / 2]) / 2.0
  }

  return mdarr[Math.floor(mdarr.length / 2)]
}

function translateBlocksToBits (blocks, pixelsPerBlock) {
  var halfBlockValue = pixelsPerBlock * 256 * 3 / 2
  var bandsize = blocks.length / 4

  // Compare medians across four horizontal bands
  for (var i = 0; i < 4; i++) {
    var m = median(blocks.slice(i * bandsize, (i + 1) * bandsize))
    for (var j = i * bandsize; j < (i + 1) * bandsize; j++) {
      var v = blocks[j]

      // Output a 1 if the block is brighter than the median.
      // With images dominated by black or white, the median may
      // end up being 0 or the max value, and thus having a lot
      // of blocks of value equal to the median.  To avoid
      // generating hashes of all zeros or ones, in that case output
      // 0 if the median is in the lower value space, 1 otherwise
      blocks[j] = Number(v > m || (Math.abs(v - m) < 1 && m > halfBlockValue))
    }
  }
}

function bitsToHexhash (bitsArray) {
  var hex = []

  for (var i = 0; i < bitsArray.length; i += 4) {
    var nibble = bitsArray.slice(i, i + 4)
    hex.push(parseInt(nibble.join(''), 2).toString(16))
  }

  return hex.join('')
}

function bmvbhashEven (data, bits) {
  var blocksizeX = Math.floor(data.width / bits)
  var blocksizeY = Math.floor(data.height / bits)

  var result = []

  for (var y = 0; y < bits; y++) {
    for (var x = 0; x < bits; x++) {
      var total = 0

      for (var iy = 0; iy < blocksizeY; iy++) {
        for (var ix = 0; ix < blocksizeX; ix++) {
          var cx = x * blocksizeX + ix
          var cy = y * blocksizeY + iy
          var ii = (cy * data.width + cx) * 4

          var alpha = data.data[ii + 3]
          total += (alpha === 0) ? 765 : data.data[ii] + data.data[ii + 1] + data.data[ii + 2]
        }
      }

      result.push(total)
    }
  }

  translateBlocksToBits(result, blocksizeX * blocksizeY)

  return bitsToHexhash(result)
}

function bmvbhash (data, bits) {
  var result = []

  var i, j, x, y
  var blockWidth, blockHeight
  var weightTop, weightBottom, weightLeft, weightRight
  var blockTop, blockBottom, blockLeft, blockRight
  var yMod, yFrac, yInt
  var xMod, xFrac, xInt
  var blocks = []

  var evenX = data.width % bits === 0
  var evenY = data.height % bits === 0

  if (evenX && evenY) {
    return bmvbhashEven(data, bits)
  }

  // initialize blocks array with 0s
  for (i = 0; i < bits; i++) {
    blocks.push([])
    for (j = 0; j < bits; j++) {
      blocks[i].push(0)
    }
  }

  blockWidth = data.width / bits
  blockHeight = data.height / bits

  for (y = 0; y < data.height; y++) {
    if (evenY) {
      // don't bother dividing y, if the size evenly divides by bits
      blockTop = blockBottom = Math.floor(y / blockHeight)
      weightTop = 1
      weightBottom = 0
    } else {
      yMod = (y + 1) % blockHeight
      yFrac = yMod - Math.floor(yMod)
      yInt = yMod - yFrac

      weightTop = (1 - yFrac)
      weightBottom = (yFrac)

      // yInt will be 0 on bottom/right borders and on block boundaries
      if (yInt > 0 || (y + 1) === data.height) {
        blockTop = blockBottom = Math.floor(y / blockHeight)
      } else {
        blockTop = Math.floor(y / blockHeight)
        blockBottom = Math.ceil(y / blockHeight)
      }
    }

    for (x = 0; x < data.width; x++) {
      var ii = (y * data.width + x) * 4

      var alpha = data.data[ii + 3]
      var avgvalue = (alpha === 0) ? 765 : data.data[ii] + data.data[ii + 1] + data.data[ii + 2]

      if (evenX) {
        blockLeft = blockRight = Math.floor(x / blockWidth)
        weightLeft = 1
        weightRight = 0
      } else {
        xMod = (x + 1) % blockWidth
        xFrac = xMod - Math.floor(xMod)
        xInt = xMod - xFrac

        weightLeft = (1 - xFrac)
        weightRight = xFrac

        // xInt will be 0 on bottom/right borders and on block boundaries
        if (xInt > 0 || (x + 1) === data.width) {
          blockLeft = blockRight = Math.floor(x / blockWidth)
        } else {
          blockLeft = Math.floor(x / blockWidth)
          blockRight = Math.ceil(x / blockWidth)
        }
      }

      // add weighted pixel value to relevant blocks
      blocks[blockTop][blockLeft] += avgvalue * weightTop * weightLeft
      blocks[blockTop][blockRight] += avgvalue * weightTop * weightRight
      blocks[blockBottom][blockLeft] += avgvalue * weightBottom * weightLeft
      blocks[blockBottom][blockRight] += avgvalue * weightBottom * weightRight
    }
  }

  for (i = 0; i < bits; i++) {
    for (j = 0; j < bits; j++) {
      result.push(blocks[i][j])
    }
  }

  translateBlocksToBits(result, blockWidth * blockHeight)

  return bitsToHexhash(result)
}

exports.bmvbhashEven = bmvbhashEven
exports.bmvbhash = bmvbhash
