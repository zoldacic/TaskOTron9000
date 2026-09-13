using System.Net;

namespace TaskOTron.Api.Services;

/// <summary>
/// Decides whether a request came from the local network. The app is reached from outside
/// via a router port-forward straight to this process, so <c>HttpContext.Connection.RemoteIpAddress</c>
/// is the real client IP — no reverse proxy sits in front, so there is no X-Forwarded-For to trust
/// (and none is trusted here, which also means it can't be spoofed to fake a local address).
/// </summary>
public static class NetworkUtil
{
    public static bool IsLocalRequest(HttpContext context)
    {
        var ip = context.Connection.RemoteIpAddress;
        return ip is not null && IsPrivate(ip);
    }

    public static bool IsPrivate(IPAddress ip)
    {
        if (ip.IsIPv4MappedToIPv6) ip = ip.MapToIPv4();

        if (IPAddress.IsLoopback(ip)) return true;

        if (ip.AddressFamily == System.Net.Sockets.AddressFamily.InterNetwork)
        {
            var b = ip.GetAddressBytes();
            return b[0] == 10                               // 10.0.0.0/8
                || (b[0] == 172 && b[1] is >= 16 and <= 31)  // 172.16.0.0/12
                || (b[0] == 192 && b[1] == 168)              // 192.168.0.0/16
                || (b[0] == 169 && b[1] == 254);             // 169.254.0.0/16 (link-local)
        }

        if (ip.AddressFamily == System.Net.Sockets.AddressFamily.InterNetworkV6)
        {
            var b = ip.GetAddressBytes();
            if ((b[0] & 0xfe) == 0xfc) return true;   // fc00::/7 (unique local)
            if (b[0] == 0xfe && (b[1] & 0xc0) == 0x80) return true; // fe80::/10 (link-local)
        }

        return false;
    }
}
