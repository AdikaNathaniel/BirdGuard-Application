/// Simple client-side representation of the logged-in user.
///
/// The backend's `/auth/login` and `/auth/register` responses are currently
/// minimal (mainly `{ accessToken }` on login), so most of these fields are
/// optional / best-effort and may be filled in later from a `/auth/me`-style
/// endpoint if one is added. For now this model exists mainly so the app has
/// a typed place to keep whatever user info it does have on hand.
class User {
  final String? id;
  final String email;
  final String? username;
  final String? userType;

  const User({
    this.id,
    required this.email,
    this.username,
    this.userType,
  });

  factory User.fromJson(Map<String, dynamic> json) {
    return User(
      id: json['id']?.toString() ?? json['_id']?.toString(),
      email: json['email'] as String? ?? '',
      username: json['username'] as String?,
      userType: json['userType'] as String?,
    );
  }

  Map<String, dynamic> toJson() => {
        if (id != null) 'id': id,
        'email': email,
        if (username != null) 'username': username,
        if (userType != null) 'userType': userType,
      };
}
