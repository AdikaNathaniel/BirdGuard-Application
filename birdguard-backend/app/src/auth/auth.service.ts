import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectModel } from '@nestjs/mongoose';
import * as bcrypt from 'bcrypt';
import { Model } from 'mongoose';
import { User, UserDocument } from '../users/schemas/user.schema';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { UserType } from './user-type.enum';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async register(dto: RegisterDto) {
    // Checked up front (not just relying on the DB's unique index) so a
    // duplicate email vs. duplicate username can be distinguished in the
    // response message -- the DB-level catch below is still the real
    // safety net against a race between this check and the insert.
    const existing = await this.userModel.findOne({
      $or: [{ email: dto.email }, { username: dto.username }],
    });

    if (existing) {
      const message =
        existing.email === dto.email ? 'Email already registered' : 'Username already taken';
      return { statusCode: 409, message };
    }

    const saltRounds = Number(this.configService.get('BCRYPT_SALT_ROUNDS') ?? 10);
    const passwordHash = await bcrypt.hash(dto.password, saltRounds);

    try {
      const user = await this.userModel.create({
        email: dto.email,
        username: dto.username,
        passwordHash,
        userType: dto.userType ?? UserType.CUSTOMER,
      });

      // Never return the password hash to the client, even on the
      // successful registration response.
      const safeUser = user.toObject();
      delete (safeUser as { passwordHash?: string }).passwordHash;
      return safeUser;
    } catch (err) {
      // Catches the rare race where two requests pass the existence
      // check above simultaneously and both attempt to insert -- the
      // DB's unique index rejects the second one.
      this.logger.error('Failed to create user', err as Error);
      return { statusCode: 409, message: 'Email or username already registered' };
    }
  }

  async login(dto: LoginDto) {
    const user = await this.userModel.findOne({ email: dto.email });

    if (!user) {
      return { statusCode: 401, message: 'Invalid credentials' };
    }

    const passwordMatches = await bcrypt.compare(dto.password, user.passwordHash);
    if (!passwordMatches) {
      return { statusCode: 401, message: 'Invalid credentials' };
    }

    // Deliberately the same generic "Invalid credentials" message for
    // both "no such user" and "wrong password" above -- doesn't reveal
    // to an attacker whether a given email is actually registered.
    const payload = {
      sub: user._id.toString(),
      email: user.email,
      username: user.username,
      userType: user.userType,
    };

    const accessToken = await this.jwtService.signAsync(payload, {
      secret: this.configService.get('JWT_SECRET'),
      expiresIn: this.configService.get('JWT_EXPIRES_IN') ?? '7d',
    });

    return { accessToken };
  }
}
