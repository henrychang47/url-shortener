def base62_encode(n: int) -> str:
    ALPHABET = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ"
    devisor = len(ALPHABET)
    dividend = n

    if n == 0:
        return "0"

    result: str = ""
    while dividend > 0:
        new_dividend, remainder = divmod(dividend, devisor)
        result += str(ALPHABET[remainder])
        dividend = new_dividend

    return result[::-1]
