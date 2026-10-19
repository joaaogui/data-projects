function isWhitespaceCharacter(character: string): boolean {
  return (
    character === " " ||
    character === "\t" ||
    character === "\n" ||
    character === "\v" ||
    character === "\f" ||
    character === "\r" ||
    character === "\u00a0" ||
    character === "\u1680" ||
    (character >= "\u2000" && character <= "\u200a") ||
    character === "\u2028" ||
    character === "\u2029" ||
    character === "\u202f" ||
    character === "\u205f" ||
    character === "\u3000" ||
    character === "\ufeff"
  )
}

function isLineTerminator(character: string): boolean {
  return (
    character === "\n" ||
    character === "\r" ||
    character === "\u2028" ||
    character === "\u2029"
  )
}

function removeBracketedContent(
  input: string,
  opening: string,
  closing: string
): string {
  let result = ""
  let index = 0

  while (index < input.length) {
    let openingIndex = index
    while (
      openingIndex < input.length &&
      isWhitespaceCharacter(input[openingIndex])
    ) {
      openingIndex += 1
    }

    if (input[openingIndex] === opening) {
      let closingIndex = openingIndex + 1
      while (
        closingIndex < input.length &&
        input[closingIndex] !== closing &&
        !isLineTerminator(input[closingIndex])
      ) {
        closingIndex += 1
      }

      if (input[closingIndex] === closing) {
        index = closingIndex + 1
        continue
      }
    }

    result += input[index]
    index += 1
  }

  return result
}

function removeRemasterSuffix(input: string): string {
  for (let start = 0; start < input.length; start += 1) {
    let index = start
    while (index < input.length && isWhitespaceCharacter(input[index])) {
      index += 1
    }
    if (input[index] !== "-") continue

    index += 1
    while (index < input.length && isWhitespaceCharacter(input[index])) {
      index += 1
    }
    if (input.slice(index, index + 8).toLowerCase() !== "remaster") continue

    index += 8
    let end = index
    while (end < input.length && !isLineTerminator(input[end])) {
      end += 1
    }
    if (end === input.length) return input.slice(0, start)
  }

  return input
}

export function cleanTrackName(track: string): string {
  const withoutParentheses = removeBracketedContent(track, "(", ")")
  const withoutBrackets = removeBracketedContent(withoutParentheses, "[", "]")
  return removeRemasterSuffix(withoutBrackets).trim()
}
