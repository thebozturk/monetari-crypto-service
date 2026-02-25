import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { getRepositoryToken } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import { AuthService } from './auth.service';
import { User } from './entities/user.entity';

jest.mock('bcrypt');

describe('AuthService', () => {
  let service: AuthService;
  let mockRepository: Record<string, jest.Mock>;
  let jwtService: jest.Mocked<JwtService>;

  const mockUser: User = {
    id: 'uuid-123',
    username: 'testuser',
    password: 'hashed-password',
    createdAt: new Date(),
  };

  beforeEach(async () => {
    mockRepository = {
      findOne: jest.fn(),
      create: jest.fn().mockReturnValue(mockUser),
      save: jest.fn().mockResolvedValue(mockUser),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: getRepositoryToken(User),
          useValue: mockRepository,
        },
        {
          provide: JwtService,
          useValue: {
            sign: jest.fn().mockReturnValue('mock-jwt-token'),
          },
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    jwtService = module.get(JwtService);
  });

  describe('signup', () => {
    it('should create a new user and return access token', async () => {
      mockRepository.findOne.mockResolvedValue(null);
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed-password');

      const result = await service.signup({
        username: 'testuser',
        password: 'password123',
      });

      expect(result).toEqual({ access_token: 'mock-jwt-token' });
      expect(mockRepository.findOne).toHaveBeenCalledWith({
        where: { username: 'testuser' },
      });
      expect(bcrypt.hash).toHaveBeenCalledWith('password123', 10);
      expect(mockRepository.save).toHaveBeenCalled();
      expect(jwtService.sign).toHaveBeenCalledWith({
        sub: 'uuid-123',
        username: 'testuser',
      });
    });

    it('should throw ConflictException if username already exists', async () => {
      mockRepository.findOne.mockResolvedValue(mockUser);

      await expect(
        service.signup({ username: 'testuser', password: 'password123' }),
      ).rejects.toThrow(ConflictException);

      expect(mockRepository.save).not.toHaveBeenCalled();
    });
  });

  describe('login', () => {
    it('should return access token for valid credentials', async () => {
      mockRepository.findOne.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      const result = await service.login({
        username: 'testuser',
        password: 'password123',
      });

      expect(result).toEqual({ access_token: 'mock-jwt-token' });
      expect(jwtService.sign).toHaveBeenCalledWith({
        sub: 'uuid-123',
        username: 'testuser',
      });
    });

    it('should throw UnauthorizedException for non-existent user', async () => {
      mockRepository.findOne.mockResolvedValue(null);

      await expect(
        service.login({ username: 'nonexistent', password: 'password123' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException for wrong password', async () => {
      mockRepository.findOne.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(
        service.login({ username: 'testuser', password: 'wrongpassword' }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });
});
