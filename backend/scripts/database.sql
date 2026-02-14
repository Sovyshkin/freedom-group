-- SQL Script для создания базы данных FREEDOM GROUP
-- Создание базы данных
IF NOT EXISTS (SELECT * FROM sys.databases WHERE name = 'freedom_group')
BEGIN
    CREATE DATABASE freedom_group;
END
GO

USE freedom_group;
GO

-- Создание таблицы Partner
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='Partner' AND xtype='U')
BEGIN
    CREATE TABLE dbo.Partner (
        Inc int PRIMARY KEY IDENTITY(1,1),
        Name varchar(255) NOT NULL,
        Email varchar(255) NOT NULL,
        Telegram varchar(255) NULL,
        CreatedAt datetime DEFAULT GETDATE(),
        IsActive bit DEFAULT 1
    );
    
    CREATE UNIQUE INDEX IX_Partner_Email ON dbo.Partner(Email);
END
GO

-- Создание таблицы Partpass
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='Partpass' AND xtype='U')
BEGIN
    CREATE TABLE dbo.Partpass (
        Inc int PRIMARY KEY IDENTITY(1,1),
        Partner int NOT NULL,
        Alias varchar(100) UNIQUE NOT NULL,
        PswHash varchar(255) NOT NULL,
        Active bit DEFAULT 1,
        LastVisit datetime NULL,
        CreatedAt datetime DEFAULT GETDATE(),
        FailedAttempts int DEFAULT 0,
        LockUntil datetime NULL,
        FOREIGN KEY (Partner) REFERENCES dbo.Partner(Inc) ON DELETE CASCADE
    );
    
    CREATE INDEX IX_Partpass_Partner ON dbo.Partpass(Partner);
    CREATE UNIQUE INDEX IX_Partpass_Alias ON dbo.Partpass(Alias);
END
GO

-- Создание таблицы Claim
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='Claim' AND xtype='U')
BEGIN
    CREATE TABLE dbo.Claim (
        Inc int PRIMARY KEY IDENTITY(1,1),
        Cdate datetime DEFAULT GETDATE(),
        Partner int NOT NULL,
        DateBeg datetime NOT NULL,
        DateEnd datetime NOT NULL,
        Amount money NOT NULL,
        PayAmount money NOT NULL,
        TaxAmount money NOT NULL,
        Published bit DEFAULT 0,
        PublishedAt datetime NULL,
        Status varchar(50) DEFAULT 'uploaded', -- uploaded, published, error
        ErrorMessage varchar(500) NULL,
        FOREIGN KEY (Partner) REFERENCES dbo.Partner(Inc) ON DELETE CASCADE
    );
    
    CREATE INDEX IX_Claim_Partner ON dbo.Claim(Partner);
    CREATE INDEX IX_Claim_Published ON dbo.Claim(Published);
    CREATE INDEX IX_Claim_DateBeg ON dbo.Claim(DateBeg);
    CREATE INDEX IX_Claim_DateEnd ON dbo.Claim(DateEnd);
END
GO

-- Создание таблицы Document
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='Document' AND xtype='U')
BEGIN
    CREATE TABLE dbo.Document (
        Inc int PRIMARY KEY IDENTITY(1,1),
        Claim int NOT NULL,
        FileName varchar(255) NOT NULL,
        FileBinary varbinary(max) NOT NULL,
        FileSize bigint NOT NULL,
        ContentType varchar(100) DEFAULT 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        UploadedAt datetime DEFAULT GETDATE(),
        FOREIGN KEY (Claim) REFERENCES dbo.Claim(Inc) ON DELETE CASCADE
    );
    
    CREATE INDEX IX_Document_Claim ON dbo.Document(Claim);
END
GO

-- Создание таблицы PasswordResetToken
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='PasswordResetToken' AND xtype='U')
BEGIN
    CREATE TABLE dbo.PasswordResetToken (
        Inc int PRIMARY KEY IDENTITY(1,1),
        Token varchar(255) UNIQUE NOT NULL,
        Partner int NOT NULL,
        ExpireAt datetime NOT NULL,
        Used bit DEFAULT 0,
        CreatedAt datetime DEFAULT GETDATE(),
        UsedAt datetime NULL,
        FOREIGN KEY (Partner) REFERENCES dbo.Partner(Inc) ON DELETE CASCADE
    );
    
    CREATE INDEX IX_PasswordResetToken_Token ON dbo.PasswordResetToken(Token);
    CREATE INDEX IX_PasswordResetToken_Partner ON dbo.PasswordResetToken(Partner);
    CREATE INDEX IX_PasswordResetToken_ExpireAt ON dbo.PasswordResetToken(ExpireAt);
END
GO

-- Создание таблицы для логирования
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='AuditLog' AND xtype='U')
BEGIN
    CREATE TABLE dbo.AuditLog (
        Inc int PRIMARY KEY IDENTITY(1,1),
        UserId int NULL,
        UserType varchar(20) NOT NULL, -- 'admin', 'partner'
        Action varchar(100) NOT NULL,
        EntityType varchar(50) NULL,
        EntityId int NULL,
        Details varchar(1000) NULL,
        IpAddress varchar(45) NULL,
        UserAgent varchar(500) NULL,
        CreatedAt datetime DEFAULT GETDATE()
    );
    
    CREATE INDEX IX_AuditLog_UserId ON dbo.AuditLog(UserId);
    CREATE INDEX IX_AuditLog_UserType ON dbo.AuditLog(UserType);
    CREATE INDEX IX_AuditLog_Action ON dbo.AuditLog(Action);
    CREATE INDEX IX_AuditLog_CreatedAt ON dbo.AuditLog(CreatedAt);
END
GO

-- Создание таблицы для админов
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='Admin' AND xtype='U')
BEGIN
    CREATE TABLE dbo.Admin (
        Inc int PRIMARY KEY IDENTITY(1,1),
        Username varchar(50) UNIQUE NOT NULL,
        PswHash varchar(255) NOT NULL,
        Email varchar(255) NULL,
        IsActive bit DEFAULT 1,
        CreatedAt datetime DEFAULT GETDATE(),
        LastLogin datetime NULL
    );
    
    CREATE UNIQUE INDEX IX_Admin_Username ON dbo.Admin(Username);
END
GO

-- Создание представлений для удобной работы
GO
CREATE OR ALTER VIEW dbo.vw_PartnerClaims AS
SELECT 
    c.Inc as ClaimId,
    c.Cdate,
    c.DateBeg,
    c.DateEnd,
    c.Amount,
    c.PayAmount,
    c.TaxAmount,
    c.Published,
    c.PublishedAt,
    c.Status,
    p.Inc as PartnerId,
    p.Name as PartnerName,
    p.Email as PartnerEmail,
    d.Inc as DocumentId,
    d.FileName,
    d.FileSize
FROM dbo.Claim c
INNER JOIN dbo.Partner p ON c.Partner = p.Inc
LEFT JOIN dbo.Document d ON c.Inc = d.Claim
WHERE p.IsActive = 1;
GO

CREATE OR ALTER VIEW dbo.vw_PartnerDocuments AS
SELECT 
    p.Inc as PartnerId,
    p.Name as PartnerName,
    c.Inc as ClaimId,
    c.DateBeg,
    c.DateEnd,
    c.Amount,
    c.PayAmount,
    c.TaxAmount,
    c.PublishedAt,
    d.Inc as DocumentId,
    d.FileName,
    d.FileSize
FROM dbo.Partner p
INNER JOIN dbo.Claim c ON p.Inc = c.Partner
INNER JOIN dbo.Document d ON c.Inc = d.Claim
WHERE p.IsActive = 1 AND c.Published = 1;
GO

-- Создание хранимых процедур
GO
CREATE OR ALTER PROCEDURE dbo.sp_CreatePartnerWithPassword
    @Name varchar(255),
    @Email varchar(255),
    @Telegram varchar(255) = NULL,
    @Alias varchar(100) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    
    BEGIN TRY
        BEGIN TRANSACTION;
        
        -- Проверяем существование партнера с таким email
        IF EXISTS (SELECT 1 FROM dbo.Partner WHERE Email = @Email)
        BEGIN
            RAISERROR('Партнер с таким email уже существует', 16, 1);
            RETURN -1;
        END
        
        -- Создаем партнера
        DECLARE @PartnerId int;
        INSERT INTO dbo.Partner (Name, Email, Telegram)
        VALUES (@Name, @Email, @Telegram);
        
        SET @PartnerId = SCOPE_IDENTITY();
        
        -- Генерируем Alias если не указан
        IF @Alias IS NULL
        BEGIN
            SET @Alias = 'partner_' + CAST(@PartnerId as varchar(10));
        END
        
        -- Проверяем уникальность Alias
        WHILE EXISTS (SELECT 1 FROM dbo.Partpass WHERE Alias = @Alias)
        BEGIN
            SET @Alias = @Alias + '_' + CAST(ABS(CHECKSUM(NEWID())) % 1000 as varchar(3));
        END
        
        -- Создаем запись в Partpass с временным паролем
        INSERT INTO dbo.Partpass (Partner, Alias, PswHash, Active)
        VALUES (@PartnerId, @Alias, 'temp_password_to_be_reset', 0);
        
        COMMIT TRANSACTION;
        
        SELECT @PartnerId as PartnerId, @Alias as Alias;
        
    END TRY
    BEGIN CATCH
        ROLLBACK TRANSACTION;
        THROW;
    END CATCH
END
GO

CREATE OR ALTER PROCEDURE dbo.sp_PublishClaims
    @ClaimIds varchar(max)
AS
BEGIN
    SET NOCOUNT ON;
    
    BEGIN TRY
        BEGIN TRANSACTION;
        
        -- Обновляем статус claims на published
        UPDATE dbo.Claim 
        SET Published = 1, 
            PublishedAt = GETDATE(),
            Status = 'published'
        WHERE Inc IN (SELECT value FROM STRING_SPLIT(@ClaimIds, ','))
        AND Published = 0;
        
        -- Возвращаем информацию для отправки уведомлений
        SELECT 
            p.Inc as PartnerId,
            p.Name as PartnerName,
            p.Email,
            p.Telegram,
            c.DateBeg,
            c.DateEnd
        FROM dbo.Claim c
        INNER JOIN dbo.Partner p ON c.Partner = p.Inc
        WHERE c.Inc IN (SELECT value FROM STRING_SPLIT(@ClaimIds, ','))
        AND c.Published = 1;
        
        COMMIT TRANSACTION;
        
    END TRY
    BEGIN CATCH
        ROLLBACK TRANSACTION;
        THROW;
    END CATCH
END
GO

PRINT 'База данных FREEDOM GROUP успешно создана!';